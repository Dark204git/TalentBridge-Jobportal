/**
 * jobController.js  (UPDATED)
 *
 * Changes from original:
 *  - createJob now calls triggerJobMatchingOnPost() from matchingService
 *    which generates the job embedding and finds candidates via pgvector.
 *  - updateJob re-embeds the job when description/skills change.
 *  - New export: getMatchingCandidates — employer endpoint to see AI-ranked candidates.
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import {
  triggerJobMatchingOnPost,
  findMatchingCandidatesForJob,
  reEmbedJob,
} from '../services/matchingService.js';

// ── Create job ────────────────────────────────────────────────────────────────
export const createJob = async (req, res) => {
  try {
    const {
      title, description, requirements, skills, location,
      job_type, salary_min, salary_max, experience_level,
      category, is_remote, application_deadline,
    } = req.body;

    const { data: profile } = await supabase
      .from('employer_profiles')
      .select('id, company_name')
      .eq('user_id', req.user.id)
      .single();

    if (!profile?.company_name) {
      return res.status(400).json({ error: 'Complete your company profile first' });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        id: uuidv4(),
        employer_id: req.user.id,
        employer_profile_id: profile.id,
        title, description, requirements,
        skills: skills || [],
        location, job_type,
        salary_min, salary_max,
        experience_level, category,
        is_remote: is_remote || false,
        application_deadline,
        status: 'active',
        views: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Fire-and-forget: embed job + find + email matched candidates
    triggerJobMatchingOnPost(job).catch(err =>
      console.error('Job matching background task failed:', err.message)
    );

    res.status(201).json(job);
  } catch (err) {
    console.error('createJob error:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

// ── List jobs (public) ────────────────────────────────────────────────────────
export const getJobs = async (req, res) => {
  try {
    const {
      search, location, job_type, experience_level,
      category, is_remote, salary_min, salary_max,
      page = 1, limit = 12,
    } = req.query;

    let query = supabase
      .from('jobs')
      .select('*, employer_profiles(company_name, company_logo, company_website)', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (search)           query = query.ilike('title', `%${search}%`);
    if (location)         query = query.ilike('location', `%${location}%`);
    if (job_type)         query = query.eq('job_type', job_type);
    if (experience_level) query = query.eq('experience_level', experience_level);
    if (category)         query = query.eq('category', category);
    if (is_remote === 'true') query = query.eq('is_remote', true);
    if (salary_min)       query = query.gte('salary_min', parseInt(salary_min));
    if (salary_max)       query = query.lte('salary_max', parseInt(salary_max));

    const from = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(from, from + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      jobs: data || [],
      total: count || 0,
      page: parseInt(page),
      totalPages: Math.ceil((count || 0) / parseInt(limit)),
    });
  } catch (err) {
    console.error('getJobs error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// ── Single job (public) ───────────────────────────────────────────────────────
export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return res.status(404).json({ error: 'Job not found' });

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        employer_profiles(
          company_name, company_logo, company_website,
          company_description, company_size, industry, headquarters
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) { console.error('getJobById error:', error); throw error; }
    if (!job)  return res.status(404).json({ error: 'Job not found' });

    supabase.from('jobs').update({ views: (job.views || 0) + 1 }).eq('id', id).then(() => {});
    if (req.user?.id) {
      supabase.from('job_views')
        .insert({ job_id: id, viewer_id: req.user.id, viewed_at: new Date().toISOString() })
        .then(() => {});
    }

    res.json({ ...job, views: (job.views || 0) + 1 });
  } catch (err) {
    console.error('getJobById error:', err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

// ── Update job ────────────────────────────────────────────────────────────────
export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('jobs').select('employer_id').eq('id', id).single();

    if (!existing || existing.employer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('jobs')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Re-embed if description/skills changed
    const needsReEmbed = req.body.description || req.body.skills || req.body.requirements;
    if (needsReEmbed) {
      reEmbedJob(id).catch(err =>
        console.error('Re-embed job failed (non-fatal):', err.message)
      );
    }

    res.json(data);
  } catch (err) {
    console.error('updateJob error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
};

// ── Close job ─────────────────────────────────────────────────────────────────
export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job } = await supabase
      .from('jobs').select('employer_id').eq('id', id).single();

    if (!job || job.employer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await supabase.from('jobs').update({ status: 'closed' }).eq('id', id);
    res.json({ message: 'Job closed successfully' });
  } catch (err) {
    console.error('deleteJob error:', err);
    res.status(500).json({ error: 'Failed to close job' });
  }
};

// ── Employer: permanently delete a closed job ───────────────────────────────────
export const permanentDeleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job } = await supabase
      .from('jobs').select('employer_id, status').eq('id', id).single();

    if (!job || job.employer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (job.status !== 'closed') {
      return res.status(400).json({ error: 'Only closed jobs can be permanently deleted' });
    }

    await supabase.from('jobs').delete().eq('id', id);
    res.json({ message: 'Job permanently deleted' });
  } catch (err) {
    console.error('permanentDeleteJob error:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
};

// ── Employer: list own jobs ───────────────────────────────────────────────────
export const getEmployerJobs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, location, job_type, status, views, is_remote, created_at, skills, application_deadline, applications(count)')
      .eq('employer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const jobs = data || [];
    const now = new Date().toISOString();
    const todayDate = now.split('T')[0]; // "YYYY-MM-DD"

    // Auto-close jobs whose deadline date is strictly BEFORE today.
    // Must compare date strings, not full ISO timestamps — "2026-05-06" < "2026-05-06T08:30:00Z"
    // is true in JS string comparison, which would close today's jobs immediately.
    const expiredIds = jobs
      .filter(j => {
        if (j.status !== 'active' || !j.application_deadline) return false;
        const dl = j.application_deadline.split('T')[0];
        return dl < todayDate; // strictly before today — today expires at midnight via cron
      })
      .map(j => j.id);

    if (expiredIds.length > 0) {
      await supabase
        .from('jobs')
        .update({ status: 'closed', updated_at: now })
        .in('id', expiredIds);

      // Reflect the change in the response without a second DB round-trip
      jobs.forEach(j => {
        if (expiredIds.includes(j.id)) j.status = 'closed';
      });
    }

    res.json(jobs);
  } catch (err) {
    console.error('getEmployerJobs error:', err);
    res.status(500).json({ error: 'Failed to fetch your jobs' });
  }
};

// ── NEW: Employer — AI-ranked candidates for a job ────────────────────────────
/**
 * GET /api/jobs/:id/matching-candidates
 * Returns candidates ranked by vector similarity to this job.
 * Only the employer who owns the job can call this.
 */
export const getMatchingCandidates = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);

    // Ownership check
    const { data: job } = await supabase
      .from('jobs').select('employer_id, title, embedding').eq('id', id).single();

    if (!job || job.employer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!job.embedding) {
      return res.status(202).json({
        message: 'Job embedding not generated yet. Check back in a few seconds.',
        candidates: [],
      });
    }

    const candidates = await findMatchingCandidatesForJob(id, limit);
    res.json({ candidates, total: candidates.length });
  } catch (err) {
    console.error('getMatchingCandidates error:', err);
    res.status(500).json({ error: 'Failed to find matching candidates' });
  }
};