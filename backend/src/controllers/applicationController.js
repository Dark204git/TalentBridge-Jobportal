import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { sendApplicationReceivedEmail, sendApplicationStatusEmail } from '../services/emailService.js';
import { notifyApplicationReceived, notifyApplicationStatusChanged } from '../services/notificationService.js';
import { computeCompositeScore, passesSalaryGate, passesExperienceGate } from '../services/matchingService.js';

// ── Helper: parse pgvector embedding (string or array) ────────────────────────
function parseEmbedding(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return null;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const applyToJob = async (req, res) => {
  try {
    const { job_id, cover_letter } = req.body;

    // Check if already applied
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', job_id)
      .eq('candidate_id', req.user.id)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Already applied to this job' });

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*, employer_profiles(company_name, company_logo) ')
      .eq('id', job_id)
      .single();

    if (jobError || !job || job.status !== 'active') {
      return res.status(404).json({ error: 'Job not found or closed' });
    }

    const { data: employerUser } = await supabase
      .from('users').select('email, full_name')
      .eq('id', job.employer_id)
      .maybeSingle();

    const { data: candidateProfile } = await supabase
      .from('candidate_profiles')
      .select('resume_url, embedding, skills, desired_salary, experience_years, preferred_location, preferred_category, preferred_job_type')
      .eq('user_id', req.user.id)
      .maybeSingle();

    // ── Compute match_score at submission time ────────────────────────────
    let match_score = null;
    const jobEmbedding       = parseEmbedding(job.embedding);
    const candidateEmbedding = parseEmbedding(candidateProfile?.embedding);

    if (jobEmbedding && candidateEmbedding) {
      const rawSim = cosineSimilarity(candidateEmbedding, jobEmbedding);
      const { composite } = computeCompositeScore(rawSim, candidateProfile, job);
      match_score = composite;
    } else {
      // Fallback: skills-only score when embeddings aren't ready yet
      const jobSkills = (job.skills || []).map(s => s.toLowerCase().trim());
      const cSkills   = (candidateProfile?.skills || []).map(s => s.toLowerCase().trim());
      const matched   = cSkills.filter(s => jobSkills.includes(s)).length;
      match_score     = jobSkills.length ? Math.round((matched / jobSkills.length) * 55) : null;
    }

    const { data: application, error } = await supabase
      .from('applications')
      .insert({
        id: uuidv4(),
        job_id,
        candidate_id: req.user.id,
        employer_id: job.employer_id,
        cover_letter,
        resume_url: candidateProfile?.resume_url,
        match_score,
        status: 'pending',
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send email to employer
    notifyApplicationReceived(job.employer_id, req.user.full_name, job.title).catch(console.error);
      if (employerUser?.email) {
        await sendApplicationReceivedEmail(
          employerUser.email, employerUser.full_name,
          req.user.full_name, job.title
        ).catch(console.error);
      }
  

    res.status(201).json(application);
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
};

export const getCandidateApplications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        jobs(id, title, location, job_type, status,
          employer_profiles(company_name, company_logo))
      `)
      .eq('candidate_id', req.user.id)
      .order('applied_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

export const getJobApplications = async (req, res) => {
  try {
    const { job_id } = req.params;

    // Verify job exists and belongs to the requesting employer
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('employer_id, id, title, location')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.employer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Fetch applications (no direct FK to candidate_profiles, fetch separately)
    const { data: applications, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', job_id)
      .order('applied_at', { ascending: false });

    if (error) throw error;

    if (applications.length === 0) return res.json([]);

    const candidateIds = applications.map(a => a.candidate_id);

    // Fetch candidate users and profiles separately (no direct FK between applications and candidate_profiles)
    const [{ data: usersData }, { data: profilesData }] = await Promise.all([
      supabase.from('users').select('id, email, full_name').in('id', candidateIds),
      supabase.from('candidate_profiles')
        .select('user_id, headline, skills, experience_years, resume_url, resume_filename, profile_picture, phone_number, date_of_birth, gender, lives_in, linkedin_url, github_url, portfolio_url')
        .in('user_id', candidateIds),
    ]);

    const usersMap = Object.fromEntries((usersData || []).map(u => [u.id, u]));
    const profilesMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p]));

    const enriched = applications.map(app => ({
      ...app,
      users: usersMap[app.candidate_id] || null,
      candidate_profiles: profilesMap[app.candidate_id] || null,
      // Include job info so the employer can see which job was applied for,
      // especially important when viewing all applications across all jobs.
      jobs: { id: job.id, title: job.title, location: job.location },
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get job applications error:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected', 'withdrawn'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*, jobs(title)')
      .eq('id', id)
      .eq('employer_id', req.user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Fetch candidate user info separately to avoid ambiguous FK issues
    const { data: candidateUser } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', application.candidate_id)
      .single();

    const { data, error } = await supabase
      .from('applications')
      .update({ status, employer_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Notify candidate
    notifyApplicationStatusChanged(application.candidate_id, application.jobs?.title, status).catch(console.error);
      if (candidateUser?.email) {
          await sendApplicationStatusEmail(
            candidateUser.email,
            candidateUser.full_name,
            application.jobs?.title,
            status
          ).catch(console.error);
        }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update application status' });
  }
};

// ── Auto-screen: score all pending applications for a job, accept ≥40% ────────
export const autoScreenApplications = async (req, res) => {
  try {
    const { job_id } = req.params;
    const THRESHOLD = 40; // percent

    // Verify job belongs to requesting employer
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, title, employer_id, embedding, skills, salary_max, experience_level, job_type, category, location')
      .eq('id', job_id)
      .single();

    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });
    if (job.employer_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const jobEmbedding = parseEmbedding(job.embedding);

    // Fetch only pending applications (don't disturb already-progressed ones)
    const { data: apps, error: appsErr } = await supabase
      .from('applications')
      .select('id, candidate_id, match_score, status')
      .eq('job_id', job_id)
      .eq('status', 'pending');

    if (appsErr) throw appsErr;
    if (!apps?.length) return res.json({ screened: 0, reviewing: 0, rejected: 0, results: [] });

    const candidateIds = apps.map(a => a.candidate_id);

    // Fetch candidate profiles for scoring
    const { data: profiles } = await supabase
      .from('candidate_profiles')
      .select('user_id, embedding, skills, desired_salary, experience_years, preferred_location, preferred_category, preferred_job_type')
      .in('user_id', candidateIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

    const results = [];
    let reviewingCount = 0;
    let rejectedCount  = 0;

    for (const app of apps) {
      const profile = profileMap[app.candidate_id] || {};

      // Use stored match_score if already computed, else compute now
      let score = app.match_score;

      if (score == null) {
        const candidateEmbedding = parseEmbedding(profile.embedding);
        if (jobEmbedding && candidateEmbedding) {
          const rawSim = cosineSimilarity(candidateEmbedding, jobEmbedding);
          const { composite } = computeCompositeScore(rawSim, profile, job);
          score = composite;
        } else {
          // Fallback: skills-only partial score
          const jobSkills = (job.skills || []).map(s => s.toLowerCase().trim());
          const cSkills   = (profile.skills || []).map(s => s.toLowerCase().trim());
          const matched   = cSkills.filter(s => jobSkills.includes(s)).length;
          score = jobSkills.length ? Math.round((matched / jobSkills.length) * 55) : 0;
        }
      }

      const newStatus = score >= THRESHOLD ? 'reviewing' : 'rejected';
      newStatus === 'reviewing' ? reviewingCount++ : rejectedCount++;

      // Bulk update in DB
      await supabase
        .from('applications')
        .update({ status: newStatus, match_score: score, updated_at: new Date().toISOString() })
        .eq('id', app.id);

      results.push({ id: app.id, candidate_id: app.candidate_id, score, status: newStatus });
    }

    // Notify candidates of status changes (fire and forget)
    for (const r of results) {
      notifyApplicationStatusChanged(r.candidate_id, job.title, r.status).catch(console.error);
    }

    res.json({
      screened:  apps.length,
      reviewing: reviewingCount,
      rejected:  rejectedCount,
      threshold: THRESHOLD,
      results,
    });
  } catch (err) {
    console.error('autoScreenApplications error:', err);
    res.status(500).json({ error: 'Failed to auto-screen applications' });
  }
};

// ── Auto-screen ALL jobs for the employer simultaneously ──────────────────────
export const autoScreenAllApplications = async (req, res) => {
  try {
    const THRESHOLD = 40;

    // Get all jobs belonging to this employer
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id, title, embedding, skills, salary_max, experience_level, job_type, category, location')
      .eq('employer_id', req.user.id);

    if (jobsErr) throw jobsErr;
    if (!jobs?.length) return res.json({ screened: 0, reviewing: 0, rejected: 0, threshold: THRESHOLD, results: [] });

    let totalScreened  = 0;
    let totalReviewing = 0;
    let totalRejected  = 0;
    const allResults   = [];

    for (const job of jobs) {
      const jobEmbedding = parseEmbedding(job.embedding);

      // Only pending apps
      const { data: apps, error: appsErr } = await supabase
        .from('applications')
        .select('id, candidate_id, match_score, status')
        .eq('job_id', job.id)
        .eq('status', 'pending');

      if (appsErr || !apps?.length) continue;

      const candidateIds = apps.map(a => a.candidate_id);

      const { data: profiles } = await supabase
        .from('candidate_profiles')
        .select('user_id, embedding, skills, desired_salary, experience_years, preferred_location, preferred_category, preferred_job_type')
        .in('user_id', candidateIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

      for (const app of apps) {
        const profile = profileMap[app.candidate_id] || {};

        let score = app.match_score;
        if (score == null) {
          const candidateEmbedding = parseEmbedding(profile.embedding);
          if (jobEmbedding && candidateEmbedding) {
            const rawSim = cosineSimilarity(candidateEmbedding, jobEmbedding);
            const { composite } = computeCompositeScore(rawSim, profile, job);
            score = composite;
          } else {
            const jobSkills = (job.skills || []).map(s => s.toLowerCase().trim());
            const cSkills   = (profile.skills || []).map(s => s.toLowerCase().trim());
            const matched   = cSkills.filter(s => jobSkills.includes(s)).length;
            score = jobSkills.length ? Math.round((matched / jobSkills.length) * 55) : 0;
          }
        }

        const newStatus = score >= THRESHOLD ? 'reviewing' : 'rejected';
        newStatus === 'reviewing' ? totalReviewing++ : totalRejected++;
        totalScreened++;

        await supabase
          .from('applications')
          .update({ status: newStatus, match_score: score, updated_at: new Date().toISOString() })
          .eq('id', app.id);

        allResults.push({ id: app.id, candidate_id: app.candidate_id, job_id: job.id, job_title: job.title, score, status: newStatus });

        notifyApplicationStatusChanged(app.candidate_id, job.title, newStatus).catch(console.error);
      }
    }

    res.json({
      screened:  totalScreened,
      reviewing: totalReviewing,
      rejected:  totalRejected,
      threshold: THRESHOLD,
      results:   allResults,
    });
  } catch (err) {
    console.error('autoScreenAllApplications error:', err);
    res.status(500).json({ error: 'Failed to auto-screen applications' });
  }
};
export const deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify application belongs to this employer and is rejected
    const { data: app, error: fetchErr } = await supabase
      .from('applications')
      .select('id, status, employer_id')
      .eq('id', id)
      .eq('employer_id', req.user.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'rejected') {
      return res.status(400).json({ error: 'Only rejected applications can be deleted' });
    }

    const { error: delErr } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    res.json({ success: true, id });
  } catch (err) {
    console.error('deleteApplication error:', err);
    res.status(500).json({ error: 'Failed to delete application' });
  }
};