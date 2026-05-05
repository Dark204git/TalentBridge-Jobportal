import { supabase } from '../config/supabase.js';
import { resumeQueue } from '../workers/resumeQueue.js';
import { generateR2PresignedUrl } from '../services/storageService.js';

export const getUploadUrl = async (req, res) => {
  try {
    const { filename, content_type } = req.body;

    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(content_type)) {
      return res.status(400).json({ error: 'Only PDF and DOCX files are allowed' });
    }

    const ext = content_type === 'application/pdf' ? 'pdf' : 'docx';
    const key = `resumes/${req.user.id}/${Date.now()}.${ext}`;

    const { uploadUrl, publicUrl } = await generateR2PresignedUrl(key, content_type);
    res.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error('Presign error:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

export const confirmResumeUpload = async (req, res) => {
  try {
    const { resume_url, filename } = req.body;

  
    await supabase
      .from('candidate_profiles')
      .update({
        resume_url,
        resume_filename:     filename,
        resume_uploaded_at:  new Date().toISOString(),
        resume_parsed:       false,      // reset on every new upload
        resume_parsed_at:    null,
        resume_parse_failed: false,      // clear any previous failure
      })
      .eq('user_id', req.user.id);

    // Add to parsing queue
    await resumeQueue.add('parse-resume', {
      user_id: req.user.id,
      resume_url,
      filename,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    res.json({ message: 'Resume uploaded and queued for parsing' });
  } catch (err) {
    console.error('Confirm upload error:', err);
    res.status(500).json({ error: 'Failed to confirm resume upload' });
  }
};

export const getResumeParseStatus = async (req, res) => {
  try {
    const { data } = await supabase
      .from('candidate_profiles')
      .select('resume_url, resume_parsed, resume_parsed_at, resume_parse_failed, skills, experience_years, headline')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!data) return res.json({ resume_parsed: false, resume_parse_failed: false });

    // If already parsed or already marked failed, return DB state immediately
    if (data.resume_parsed || data.resume_parse_failed) return res.json(data);

    // Still pending — check BullMQ job state for a failure we haven't recorded yet
    try {
      const { resumeQueue } = await import('../workers/resumeQueue.js');
      const jobs = await resumeQueue.getJobs(['failed']);
      const failedJob = jobs.find(j => j.data?.user_id === req.user.id);
      if (failedJob) {
        // Record the failure in DB so future polls return immediately
        await supabase.from('candidate_profiles')
          .update({ resume_parse_failed: true })
          .eq('user_id', req.user.id);
        return res.json({ ...data, resume_parse_failed: true, parse_error: failedJob.failedReason });
      }
    } catch (queueErr) {
      // Queue unavailable — just return DB state
      console.warn('Could not check queue state:', queueErr.message);
    }

    res.json(data);
  } catch (err) {
    console.error('getResumeParseStatus error:', err);
    res.status(500).json({ error: 'Failed to get parse status' });
  }
};