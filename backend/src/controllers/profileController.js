import { supabase } from '../config/supabase.js';
import { reEmbedCandidate } from '../services/matchingService.js'; 

export const getCandidateProfile = async (req, res) => {
  try {
    let { data, error } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: created, error: createError } = await supabase
        .from('candidate_profiles')
        .insert({ user_id: req.user.id })
        .select()
        .single();
      if (createError) throw createError;
      data = created;
    }

    res.json(data);
  } catch (err) {
    console.error('getCandidateProfile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateCandidateProfile = async (req, res) => {
  try {
    const {
      headline, bio, skills, experience_years, education,
      experience, desired_salary, preferred_location, desired_job_title,
      linkedin_url, github_url, portfolio_url, is_open_to_work,
      phone_number, date_of_birth, gender, lives_in,
      preferred_category,
      preferred_job_type,
    } = req.body;

    const toInt = (v) => (v === '' || v == null) ? null : parseInt(v, 10) || null;

    const { data, error } = await supabase
      .from('candidate_profiles')
      .upsert({
        user_id: req.user.id,
        headline, bio, skills,
        experience_years: toInt(experience_years),
        education, experience,
        desired_salary, preferred_location, desired_job_title,
        linkedin_url, github_url, portfolio_url, is_open_to_work,
        phone_number, date_of_birth: date_of_birth || null,
        gender, lives_in, preferred_category, preferred_job_type,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
     reEmbedCandidate(req.user.id).catch(err =>
      console.error('Background re-embed failed:', err.message)
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getEmployerProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employer_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employer profile' });
  }
};

export const updateEmployerProfile = async (req, res) => {
  try {
    const {
      company_name, company_description, industry, company_size,
      company_website, company_logo, headquarters, founded_year,
      linkedin_url, twitter_url
    } = req.body;

    const { data, error } = await supabase
      .from('employer_profiles')
      .update({
        company_name, company_description, industry, company_size,
        company_website, company_logo, headquarters, founded_year,
        linkedin_url, twitter_url,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update employer profile' });
  }
};

export const saveJob = async (req, res) => {
  try {
    const { job_id } = req.body;
    const { data: existing } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('job_id', job_id)
      .maybeSingle();

    if (existing) {
      await supabase.from('saved_jobs').delete().eq('id', existing.id);
      return res.json({ saved: false });
    }

    await supabase.from('saved_jobs').insert({ user_id: req.user.id, job_id, saved_at: new Date().toISOString() });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save job' });
  }
};

export const getSavedJobs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select(`*, jobs(*, employer_profiles(company_name, company_logo))`)
      .eq('user_id', req.user.id)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved jobs' });
  }
};

export const uploadProfilePicture = async (req, res) => {
  try {
    const { filename, content_type } = req.body;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(content_type)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, WEBP or GIF images are allowed' });
    }
    const ext = content_type.split('/')[1];
    const key = `profile-pictures/${req.user.id}/${Date.now()}.${ext}`;
    const { generateR2PresignedUrl } = await import('../services/storageService.js');
    const { uploadUrl, publicUrl } = await generateR2PresignedUrl(key, content_type);
    res.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error('Profile picture presign error:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

export const confirmProfilePicture = async (req, res) => {
  try {
    const { profile_picture_url } = req.body;
    const { data, error } = await supabase
      .from('candidate_profiles')
      .update({ profile_picture: profile_picture_url, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ profile_picture: data.profile_picture });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save profile picture' });
  }
};