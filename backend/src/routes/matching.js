
import express from 'express';
import { authenticate, requireCandidate, requireRole } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import {
  findMatchingJobsForCandidate,
  reEmbedCandidate,
  reEmbedJob,
  computeCompositeScore,
  passesSalaryGate,
  passesExperienceGate,
  EXPERIENCE_TIERS,
} from '../services/matchingService.js';
import { cosineSimilarity, similarityToPercent } from '../services/embeddingService.js';

const router = express.Router();

//Helper: parse embedding string to number[]  
function parseEmbedding(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return null;
}

//Candidate: get AI-matched jobs ─
router.get('/jobs-for-me', authenticate, requireCandidate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '15'), 15);
    const jobs  = await findMatchingJobsForCandidate(req.user.id, limit);
    res.json({ jobs, total: jobs.length });
  } catch (err) {
    console.error('jobs-for-me error:', err);
    res.status(500).json({ error: 'Failed to find matching jobs' });
  }
});


router.get('/debug-scores', authenticate, requireCandidate, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('embedding, skills, desired_salary, experience_years, preferred_location, preferred_category, preferred_job_type')
      .eq('user_id', req.user.id)
      .single();

    const candidateEmbedding = profile?.embedding
      ? (Array.isArray(profile.embedding) ? profile.embedding : JSON.parse(profile.embedding))
      : null;

    const { data: appliedRows } = await supabase
      .from('applications').select('job_id').eq('candidate_id', req.user.id);
    const appliedIds = new Set((appliedRows || []).map(r => r.job_id));

    const { data: allJobs } = await supabase
      .from('jobs')
      .select('id, title, skills, salary_max, experience_level, job_type, category, location, embedding, created_at')
      .eq('status', 'active');

    const results = (allJobs || []).map(job => {
      const jobEmb = job.embedding
        ? (Array.isArray(job.embedding) ? job.embedding : (() => { try { return JSON.parse(job.embedding); } catch { return null; } })())
        : null;

      let rawSim = null, composite = null, breakdown = null;
      if (candidateEmbedding && jobEmb) {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < candidateEmbedding.length; i++) {
          dot   += candidateEmbedding[i] * jobEmb[i];
          normA += candidateEmbedding[i] * candidateEmbedding[i];
          normB += jobEmb[i] * jobEmb[i];
        }
        rawSim = (normA && normB) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
        const result = computeCompositeScore(rawSim, profile, job);
        composite = result.composite;
        breakdown = result.breakdown;
      }

      return {
        id:             job.id,
        title:          job.title,
        has_embedding:  !!jobEmb,
        already_applied: appliedIds.has(job.id),
        salary_gate:    passesSalaryGate(profile?.desired_salary, job.salary_max),
        exp_gate:       passesExperienceGate(profile?.experience_years, job.experience_level),
        raw_similarity: rawSim !== null ? +rawSim.toFixed(4) : null,
        composite_score: composite,
        breakdown,
      };
    }).sort((a, b) => (b.composite_score ?? -1) - (a.composite_score ?? -1));

    res.json({
      candidate_has_embedding: !!candidateEmbedding,
      total_active_jobs: allJobs?.length ?? 0,
      jobs: results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Candidate: force re-embed their own profile ──
router.post('/re-embed-me', authenticate, requireCandidate, async (req, res) => {
  try {
    await reEmbedCandidate(req.user.id);
    res.json({ message: 'Profile embedding updated. Match scores refreshed.' });
  } catch (err) {
    console.error('re-embed-me error:', err);
    res.status(500).json({ error: 'Failed to re-embed profile' });
  }
});

//Admin: force re-embed a job )─
router.post('/re-embed-job/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await reEmbedJob(req.params.id);
    res.json({ message: 'Job embedding updated.' });
  } catch (err) {
    console.error('re-embed-job error:', err);
    res.status(500).json({ error: 'Failed to re-embed job' });
  }
});

//Candidate: get match score for a specific job 
router.get('/score/:jobId', authenticate, requireCandidate, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get candidate embedding
    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('embedding')
      .eq('user_id', req.user.id)
      .single();

    // Get job embedding
    const { data: job } = await supabase
      .from('jobs')
      .select('embedding, title')
      .eq('id', jobId)
      .single();

    const candidateVec = parseEmbedding(profile?.embedding);
    const jobVec       = parseEmbedding(job?.embedding);

    if (!candidateVec || !jobVec) {
      return res.json({ score: null, message: 'Embeddings not generated yet' });
    }

    const sim   = cosineSimilarity(candidateVec, jobVec);
    const score = similarityToPercent(sim);

    res.json({ score, jobTitle: job.title });
  } catch (err) {
    console.error('score error:', err);
    res.status(500).json({ error: 'Failed to compute match score' });
  }
});

//Re-embed ALL active jobs ()
router.post('/re-embed-all-jobs', authenticate, async (req, res) => {
  try {
    const { reEmbedJob } = await import('../services/matchingService.js');
    const { supabase }   = await import('../config/supabase.js');

    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('status', 'active');

    if (!jobs?.length) return res.json({ message: 'No active jobs found', count: 0 });

    let done = 0;
    for (const job of jobs) {
      await reEmbedJob(job.id).catch(e => console.error(`Failed to re-embed job ${job.title}:`, e.message));
      done++;
      console.log(`  Re-embedded ${done}/${jobs.length}: ${job.title}`);
    }
    console.log(`✅ All ${done} jobs re-embedded`);
    res.json({ message: `Re-embedded ${done} of ${jobs.length} jobs successfully.`, count: done });
  } catch (err) {
    console.error('re-embed-all-jobs error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to re-embed jobs' });
  }
});

router.get('/debug', authenticate, requireCandidate, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select(
        'embedding, skills, headline, desired_salary, experience_years, ' +
        'preferred_location, preferred_category, preferred_job_type'
      )
      .eq('user_id', req.user.id)
      .single();

    const candidateEmbedding = parseEmbedding(profile?.embedding);

    // Check how many jobs have embeddings
    const { count: jobsWithEmbedding } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .not('embedding', 'is', null);

    // Test the RPC directly
    let rpcResult = null;
    let rpcError  = null;
    if (candidateEmbedding) {
      const { data, error } = await supabase.rpc('match_jobs_for_candidate', {
        query_embedding: candidateEmbedding,
        match_threshold: 0.0,  
        match_count: 3,
      });
      rpcResult = data?.length ?? 0;
      rpcError  = error?.message ?? null;
    }

    // Compute composite scores for a sample of jobs 
    let sampleScores = [];
    if (candidateEmbedding) {
      const { data: sampleJobs } = await supabase
        .from('jobs')
        .select('id, title, embedding, skills, salary_max, experience_level, job_type, category, location')
        .eq('status', 'active')
        .not('embedding', 'is', null)
        .limit(5);

      sampleScores = (sampleJobs || []).map(j => {
        const jEmb = parseEmbedding(j.embedding);
        if (!jEmb) return { title: j.title, error: 'embedding parse failed' };

        const salaryPass     = passesSalaryGate(profile?.desired_salary, j.salary_max);
        const experiencePass = passesExperienceGate(profile?.experience_years, j.experience_level);
        const hardPass       = salaryPass && experiencePass;

        const rawSim = cosineSimilarity(candidateEmbedding, jEmb);
        const { composite, breakdown } = computeCompositeScore(rawSim, profile || {}, j);

        return {
          title:            j.title,
          raw_cosine:       rawSim.toFixed(4),
          hard_filters:     { salary: salaryPass, experience: experiencePass, pass: hardPass },
          composite_score:  hardPass ? composite : 'FILTERED OUT',
          score_breakdown:  breakdown,
        };
      });
    }

    res.json({
      candidate_has_embedding:  !!candidateEmbedding,
      embedding_dimensions:     candidateEmbedding?.length ?? null,
      embedding_type_from_db:   typeof profile?.embedding,
      jobs_with_embedding:      jobsWithEmbedding ?? 0,
      rpc_match_jobs_count:     rpcResult,
      rpc_error:                rpcError,
      rpc_missing:              rpcError?.includes('does not exist') ?? false,
      candidate_filters: {
        desired_salary:      profile?.desired_salary     ?? null,
        experience_years:    profile?.experience_years   ?? null,
        preferred_location:  profile?.preferred_location ?? null,
        preferred_category:  profile?.preferred_category ?? null,
        preferred_job_type:  profile?.preferred_job_type ?? null,
      },
      experience_tier_map:      EXPERIENCE_TIERS,
      sample_composite_scores:  sampleScores,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;