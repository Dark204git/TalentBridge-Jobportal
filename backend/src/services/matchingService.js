
import { supabase } from '../config/supabase.js';
import {
  embed,
  cosineSimilarity,
  similarityToPercent,
  buildCandidateText,
  buildJobText,
} from './embeddingService.js';
import { sendNewJobMatchEmail } from './emailService.js';
import { notifyJobMatch } from './notificationService.js';

//Thresholds 

const MATCH_THRESHOLD    = 0.0;   
const DISPLAY_MIN_SCORE  = 30;    
                                   
const EMAIL_THRESHOLD    = 0.10;  
                                  
const EMAIL_MIN_SCORE    = 65;    
const MAX_EMAIL_PER_JOB  = 50;
const MAX_MATCH_LIST     = 15;    

//Score weights (must sum to 100) ─
const W_SEMANTIC  = 45;
const W_SKILLS    = 25;
const W_CATEGORY  = 15;
const W_JOB_TYPE  = 10;
const W_LOCATION  =  5;

//Experience-level tier map 
export const EXPERIENCE_TIERS = {
  entry:     { min: 0,  max: 2  },
  mid:       { min: 3,  max: 5  },
  senior:    { min: 6,  max: 8  },
  lead:      { min: 9,  max: 10 },
  executive: { min: 11, max: Infinity },
};

//Embedding normaliser ──

function parseEmbedding(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

//Hard-filter helpers 

/**
 * 
 *
 * @param {number|null} expectedSalary  candidate.desired_salary
 * @param {number|null} maxSalary       job.salary_max
 */
export function passesSalaryGate(expectedSalary, maxSalary) {
  if (expectedSalary == null || maxSalary == null) return true;  // soft-fail open
  return expectedSalary <= maxSalary;
}

/**
 *
 *
 * @param {number|null} years     candidate.experience_years
 * @param {string|null} levelKey  job.experience_level (e.g. 'mid')
 */
export function passesExperienceGate(years, levelKey) {
  if (years == null || !levelKey) return true;                  // soft-fail open
  const tier = EXPERIENCE_TIERS[levelKey?.toLowerCase()];
  if (!tier) return true;                                       // unknown tier → open
  return years >= tier.min && years <= tier.max;
}

//Secondary-score helpers ──

/**
 * 
 *
 * @param {string[]} candidateSkills
 * @param {string[]} jobSkills
 * @returns {number}
 */
function skillScore(candidateSkills, jobSkills) {
  if (!jobSkills?.length) return Math.round(W_SKILLS / 2);  // no requirements → neutral
  if (!candidateSkills?.length) return 0;

  const cSet    = new Set(candidateSkills.map(s => s.toLowerCase().trim()));
  const matched = jobSkills.filter(s => cSet.has(s.toLowerCase().trim())).length;
  return Math.round((matched / jobSkills.length) * W_SKILLS);
}

/**
 * 
 *
 * @param {string|null} a
 * @param {string|null} b
 * @param {number}      weight
 */
function boolScore(a, b, weight) {
  if (a == null || b == null) return Math.round(weight / 2);  // neutral
  return a.toLowerCase().trim() === b.toLowerCase().trim() ? weight : 0;
}

/**
 * Location score: full weight on exact match OR when either side is 'remote'.
 *
 * @param {string|null} candidateLocation
 * @param {string|null} jobLocation
 * @returns {number}
 */
function locationScore(candidateLocation, jobLocation) {
  if (!candidateLocation || !jobLocation) return Math.round(W_LOCATION / 2);
  const c = candidateLocation.toLowerCase().trim();
  const j = jobLocation.toLowerCase().trim();
  if (c === j)                             return W_LOCATION;
  if (c === 'remote' || j === 'remote')    return W_LOCATION;
  return 0;
}

//Soft-penalty helpers /experience gates) 


function salaryPenalty(expectedSalary, maxSalary) {
  if (expectedSalary == null || maxSalary == null) return 1.0;
  if (expectedSalary <= maxSalary) return 1.0;
  const overage = (expectedSalary - maxSalary) / maxSalary;
  if (overage <= 0.20) return 1.0 - (overage / 0.20) * 0.30;
  return 0.5;
}


function experiencePenalty(years, levelKey) {
  if (years == null || !levelKey) return 1.0;
  const tier = EXPERIENCE_TIERS[levelKey?.toLowerCase()];
  if (!tier) return 1.0;
  if (years >= tier.min && years <= tier.max) return 1.0;
  const gap = years < tier.min ? tier.min - years : years - tier.max;
  if (gap <= 2) return 0.75;
  return 0.5;
}

/**
 * 
 *
 * @param {number}  rawSimilarity  cosine similarity [-1, 1]
 * @param {object}  candidate      candidate_profiles row
 * @param {object}  job            jobs row
 * @returns {{ composite: number, breakdown: object }}
 */
export function computeCompositeScore(rawSimilarity, candidate, job) {
  // Semantic component — keep as float until final round to avoid double-rounding
  const semanticPct    = similarityToPercent(rawSimilarity);             // 0–100 int
  const semanticPoints = (semanticPct / 100) * W_SEMANTIC;               // float

  const skillPoints    = skillScore(candidate.skills,            job.skills);
  const categoryPoints = boolScore(candidate.preferred_category, job.category,  W_CATEGORY);
  const jobTypePoints  = boolScore(candidate.preferred_job_type, job.job_type,  W_JOB_TYPE);
  const locationPoints = locationScore(candidate.preferred_location, job.location);

  const rawComposite = Math.min(
    100,
    semanticPoints + skillPoints + categoryPoints + jobTypePoints + locationPoints
  );

  // Soft penalties for salary/experience mismatch — rank lower, not hidden
  const sPenalty  = salaryPenalty(candidate.desired_salary, job.salary_max);
  const ePenalty  = experiencePenalty(candidate.experience_years, job.experience_level);
  // Single Math.round at the very end to avoid accumulated rounding error
  const composite = Math.round(rawComposite * sPenalty * ePenalty);

  return {
    composite,
    breakdown: {
      semantic:           Math.round(semanticPoints),
      skills:             skillPoints,
      category:           categoryPoints,
      job_type:           jobTypePoints,
      location:           locationPoints,
      salary_penalty:     sPenalty,
      experience_penalty: ePenalty,
    },
  };
}

//1. Find best jobs for a candidate 
/**
 *
 * @param {string}  userId
 * @param {number}  limit
 * @returns {Promise<Array>}
 */
export async function findMatchingJobsForCandidate(userId, limit = 20) {
  //Fetch candidate profile 
  const { data: profile, error } = await supabase
    .from('candidate_profiles')
    .select(
      'embedding, skills, headline, desired_job_title, experience_years, bio, ' +
      'desired_salary, preferred_location, preferred_category, preferred_job_type'
    )
    .eq('user_id', userId)
    .single();

  if (error || !profile) return [];

  const candidateEmbedding = parseEmbedding(profile.embedding);

  //Fetch job IDs the candidate has already applied to ─
  const { data: appliedRows } = await supabase
    .from('applications')
    .select('job_id')
    .eq('candidate_id', userId);
  const appliedJobIds = new Set((appliedRows || []).map(r => r.job_id));

 
  const hardFiltersPass = (job) => !appliedJobIds.has(job.id);

  //Path A: pgvector RPC (fastest — uses DB index) 
  if (candidateEmbedding) {
    const { data: vectorJobs, error: matchErr } = await supabase.rpc(
      'match_jobs_for_candidate',
      {
        query_embedding: candidateEmbedding,
        match_threshold: MATCH_THRESHOLD,
        match_count:     500,
      }
    );

    if (!matchErr && vectorJobs?.length) {
      const jobIds = vectorJobs.map(j => j.id);

      const { data: fullJobs } = await supabase
        .from('jobs')
        .select('*, employer_profiles(company_name, company_logo)')
        .in('id', jobIds)
        .eq('status', 'active');

      const similarityMap = Object.fromEntries(vectorJobs.map(j => [j.id, j.similarity]));

      const scored = (fullJobs || [])
        .filter(hardFiltersPass)
        .map(job => {
          const rawSim = similarityMap[job.id] ?? 0;
          const { composite, breakdown } = computeCompositeScore(rawSim, profile, job);
          return { ...job, embedding: undefined, match_score: composite, score_breakdown: breakdown };
        })
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit);

      if (scored.length) return scored;
    }

    // pgvector RPC failed or empty — compute in-process
    console.warn('pgvector RPC failed or empty, computing scores in-process');

    const { data: allJobs } = await supabase
      .from('jobs')
      .select('*, employer_profiles(company_name, company_logo)')
      .eq('status', 'active')
      .not('embedding', 'is', null)
      .limit(300);

    if (allJobs?.length) {
      const scored = allJobs
        .filter(hardFiltersPass)
        .map(job => {
          const jobEmbedding = parseEmbedding(job.embedding);
          if (!jobEmbedding) return null;
          const rawSim = cosineSimilarity(candidateEmbedding, jobEmbedding);
          const { composite, breakdown } = computeCompositeScore(rawSim, profile, job);
          return { ...job, embedding: undefined, match_score: composite, score_breakdown: breakdown };
        })
        .filter(Boolean)
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit);

      if (scored.length) return scored;
    }
  }

  //Path B: Keyword / skill-overlap fallback (no embedding yet) ─
  if (profile.skills?.length) {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('*, employer_profiles(company_name, company_logo)')
      .eq('status', 'active')
      .overlaps('skills', profile.skills)
      .order('created_at', { ascending: false })
      .limit(limit * 3);

    if (!jobs?.length) return [];

    const scored = jobs
      .filter(hardFiltersPass)
      .map(job => {
        const skillPts    = skillScore(profile.skills, job.skills);
        const categoryPts = boolScore(profile.preferred_category, job.category,  W_CATEGORY);
        const jobTypePts  = boolScore(profile.preferred_job_type,  job.job_type,  W_JOB_TYPE);
        const locationPts = locationScore(profile.preferred_location, job.location);
        const composite   = Math.min(100, skillPts + categoryPts + jobTypePts + locationPts);
        return {
          ...job,
          match_score: composite,
          score_breakdown: { semantic: 0, skills: skillPts, category: categoryPts, job_type: jobTypePts, location: locationPts },
        };
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    return scored;
  }

  return [];
}

//2. Find best candidates for a job 
/**
 * Given a job id, return the top N matching candidates.
 *
 * @param {string} jobId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function findMatchingCandidatesForJob(jobId, limit = 30) {
  const { data: job } = await supabase
    .from('jobs')
    .select('embedding, skills, title, salary_max, experience_level, job_type, category, location')
    .eq('id', jobId)
    .single();

  const jobEmbedding = parseEmbedding(job?.embedding);
  if (!jobEmbedding) return [];

  const { data: candidates, error } = await supabase.rpc(
    'match_candidates_for_job',
    {
      query_embedding: jobEmbedding,
      match_threshold: MATCH_THRESHOLD,
      match_count:     limit * 3,   
    }
  );

  if (error || !candidates?.length) return [];

  const userIds = candidates.map(c => c.user_id);

  // Fetch profiles for hard-filter fields + scoring dimensions
  const { data: profiles } = await supabase
    .from('candidate_profiles')
    .select('user_id, skills, desired_salary, experience_years, preferred_location, preferred_category, preferred_job_type')
    .in('user_id', userIds);

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', userIds);

  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

  const scored = candidates
    .map(c => {
      const p = profileMap[c.user_id] || {};
      const { composite, breakdown } = computeCompositeScore(c.similarity, p, job);
      return {
        ...c,
        user:            userMap[c.user_id] || null,
        match_score:     composite,
        score_breakdown: breakdown,
      };
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);

  return scored;
}

//3. Trigger matching when a job is posted ──
/**
 *
 * @param {object} job  full jobs row
 */
export async function triggerJobMatchingOnPost(job) {
  console.log(`🔍 Running vector matching for job: ${job.title}`);

  try {
    // 3a. Generate + store job embedding
    const jobText   = buildJobText(job);
    const jobVector = await embed(jobText);

    await supabase
      .from('jobs')
      .update({ embedding: jobVector })
      .eq('id', job.id);

    // 3b. Find top matching candidates via pgvector (over-fetch for filtering)
    const { data: rawCandidates } = await supabase.rpc('match_candidates_for_job', {
      query_embedding: jobVector,
      match_threshold: EMAIL_THRESHOLD,
      match_count:     MAX_EMAIL_PER_JOB * 2,
    });

    if (!rawCandidates?.length) {
      console.log(`  No strong matches found for "${job.title}"`);
      return;
    }

    // Fetch FULL profiles for composite scoring
    const userIds = rawCandidates.map(c => c.user_id);
    const { data: profiles } = await supabase
      .from('candidate_profiles')
      .select('user_id, skills, desired_salary, experience_years, preferred_location, preferred_category, preferred_job_type')
      .in('user_id', userIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

    
    const qualifiedCandidates = rawCandidates.slice(0, MAX_EMAIL_PER_JOB);

    // 3c. Get email addresses + employer company name for in-app notification
    const qualifiedIds = qualifiedCandidates.map(c => c.user_id);
    const [{ data: users }, { data: employerProfile }] = await Promise.all([
      supabase.from('users').select('id, email, full_name').in('id', qualifiedIds),
      supabase.from('employer_profiles').select('company_name').eq('user_id', job.employer_id).single(),
    ]);
    const companyName = employerProfile?.company_name ?? 'a company';

    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

    // 3d. For each qualified candidate: check 15-job cap and notify
    let emailsSent = 0;
    for (const candidate of qualifiedCandidates) {
      const user = userMap[candidate.user_id];
      if (!user?.email) continue;

      const p = profileMap[candidate.user_id] || {};
      const { composite } = computeCompositeScore(candidate.similarity, p, job);

   
      const { data: currentMatchJobs } = await supabase
        .from('jobs')
        .select('id, created_at, embedding, skills, salary_max, experience_level, job_type, category, location')
        .eq('status', 'active')
        .not('embedding', 'is', null);

      // Compute composite scores for all current matches for this candidate
      const currentScored = (currentMatchJobs || [])
        .filter(j => j.id !== job.id) // exclude the new job itself
        .map(j => {
          const jEmb = parseEmbedding(j.embedding);
          if (!jEmb) return null;
          const rawSim = cosineSimilarity(
            Array.isArray(jobVector) ? jobVector : JSON.parse(jobVector),
            jEmb
          );
          const { composite: score } = computeCompositeScore(rawSim, p, j);
          return score >= DISPLAY_MIN_SCORE
            ? { id: j.id, score, created_at: j.created_at }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score || new Date(a.created_at) - new Date(b.created_at));
      // ^ ascending: index 0 = lowest score, ties broken by oldest first

      let shouldNotify = true;

      if (currentScored.length >= MAX_MATCH_LIST) {
        const lowest = currentScored[0];

        if (composite > lowest.score) {
          // New job outscores the weakest — it earns a slot; lowest is evicted
          console.log(`  📤 Evicting job ${lowest.id} (score ${lowest.score}) for candidate ${candidate.user_id}`);
        } else if (composite === lowest.score) {
          // Tie — evict the oldest (already sorted oldest-first at index 0)
          console.log(`  📤 Tie-breaking: evicting oldest job ${lowest.id} (score ${lowest.score}) for candidate ${candidate.user_id}`);
        } else {
          // New job scores lower than everything in the list — skip
          shouldNotify = false;
        }
      }

      if (!shouldNotify) continue;

      // Only email candidates whose composite score is ≥ 70%
      if (composite < EMAIL_MIN_SCORE) continue;

      await sendNewJobMatchEmail(
        user.email,
        user.full_name,
        job.title,
        composite
      ).catch(e => console.error('Match email failed:', e.message));

      notifyJobMatch(
        candidate.user_id,
        job.title,
        companyName,
        composite
      ).catch(e => console.error('Match notification failed:', e.message));

      emailsSent++;
    }

    console.log(`  ✅ Matched ${qualifiedCandidates.length} candidates, sent ${emailsSent} emails`);
  } catch (err) {
    console.error('triggerJobMatchingOnPost error:', err.message);
  }
}

//4. Trigger matching when a resume is parsed ──
/**
 *
 * @param {string} userId
 * @param {object} profile  updated candidate_profiles row
 */
export async function triggerCandidateMatchOnResume(userId, profile) {
  console.log(`🔍 Generating embedding for candidate ${userId}`);

  try {
    // 4a. Build text and embed
    const candidateText = buildCandidateText(profile);
    if (!candidateText.trim()) return;

    const candidateVector = await embed(candidateText);

    // 4b. Store embedding
    await supabase
      .from('candidate_profiles')
      .update({ embedding: candidateVector })
      .eq('user_id', userId);

    console.log(`  ✅ Candidate embedding stored for ${userId}`);

    // 4c. Back-fill match_score on existing applications
    const { data: applications } = await supabase
      .from('applications')
      .select('id, job_id')
      .eq('candidate_id', userId);

    if (!applications?.length) return;

    for (const app of applications) {
      const { data: job } = await supabase
        .from('jobs')
        .select('embedding, skills, salary_max, experience_level, job_type, category, location')
        .eq('id', app.job_id)
        .single();

      const jobEmbedding = parseEmbedding(job?.embedding);
      if (!jobEmbedding) continue;

      // Salary/experience mismatches apply score penalties, not hard elimination
      const rawSim = cosineSimilarity(candidateVector, jobEmbedding);
      const { composite } = computeCompositeScore(rawSim, profile, job);
      const score = composite;

      await supabase
        .from('applications')
        .update({ match_score: score })
        .eq('id', app.id);
    }

    console.log(`  ✅ match_score updated on ${applications.length} existing applications`);
  } catch (err) {
    console.error('triggerCandidateMatchOnResume error:', err.message);
  }
}

//5. Re-embed a single candidate (call after profile update) ─
export async function reEmbedCandidate(userId) {
  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!profile) return;
  await triggerCandidateMatchOnResume(userId, profile);
}

//6. Re-embed a single job (call after job update) ──
export async function reEmbedJob(jobId) {
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job) return;

  const jobText   = buildJobText(job);
  const jobVector = await embed(jobText);

  await supabase
    .from('jobs')
    .update({ embedding: jobVector })
    .eq('id', jobId);

  console.log(`✅ Re-embedded job: ${job.title}`);
}