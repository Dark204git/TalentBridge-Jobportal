import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Plus, Save, CheckCircle, Loader, Camera, User, Trash2, AlertTriangle } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { profilesAPI, authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const COMMON_SKILLS = [
  'JavaScript', 'React', 'Node.js', 'Python', 'TypeScript', 'SQL', 'AWS',
  'Docker', 'Git', 'Java', 'Figma', 'Photoshop', 'Excel',
  'Project Management', 'Agile', 'Leadership', 'Communication', 'Marketing',
  'SEO', 'Salesforce',
];

// Converts education/experience from DB (string or JSONB array) into
// human-readable text for the textarea. Prevents raw JSON showing to users.
function formatArrayToText(arr) {
  return arr.map(item => {
    if (typeof item === 'string') return item;
    // Education entry: { degree, field, institution, year, graduationYear }
    if (item.degree || item.institution) {
      const parts = [
        item.degree,
        item.field && `(${item.field})`,
        item.institution,
        item.year || item.graduationYear,
      ].filter(Boolean);
      return parts.join(', ');
    }
    // Work experience entry: { title, company, duration, startDate, endDate, responsibilities }
    if (item.title || item.company) {
      const duration = item.duration || [item.startDate, item.endDate].filter(Boolean).join(' – ');
      const line = [item.title, item.company && `@ ${item.company}`, duration].filter(Boolean).join(' ');
      const bullets = item.responsibilities?.length
        ? '\n' + item.responsibilities.map(r => `  • ${r}`).join('\n')
        : (item.description ? `\n  ${item.description}` : '');
      return line + bullets;
    }
    // Unknown shape — pretty print key: value pairs
    return Object.entries(item)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }).join('\n\n');
}

function formatTextareaField(value) {
  if (!value) return '';

  // Already a plain string — but may be a JSON-serialised array stored in a TEXT column.
  // Try to parse it; if it's not valid JSON, return as-is.
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        // Parsed successfully — recurse with the real value
        return formatTextareaField(parsed);
      } catch {
        // Not JSON — plain text written by the user, return as-is
        return value;
      }
    }
    return value;
  }

  if (Array.isArray(value)) return formatArrayToText(value);

  // Object (single entry, not wrapped in array)
  if (typeof value === 'object') return formatArrayToText([value]);

  return String(value);
}

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'freelance', 'internship'];

const CATEGORIES = [
  'Technology', 'Finance', 'Design', 'Marketing', 'Healthcare',
  'Legal', 'Education', 'Engineering', 'Sales', 'HR', 'Other',
];

export default function CandidateProfile() {
  const navigate        = useNavigate();
  const { logout, user, updateUser } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [form, setForm] = useState({
    headline: '', bio: '', skills: [], experience_years: '',
    desired_job_title: '', preferred_category: '', preferred_job_type: '', preferred_location: '', desired_salary: '',
    linkedin_url: '', github_url: '', portfolio_url: '', is_open_to_work: true,
    education: '', experience: '',
    // New fields
    phone_number: '',
    date_of_birth: '', gender: '', lives_in: '',
  });

  const [profilePicture, setProfilePicture]       = useState(null);
  const [uploadingPic, setUploadingPic]           = useState(false);
  const [loading, setLoading]                     = useState(true);
  const [saving, setSaving]                       = useState(false);
  const [skillInput, setSkillInput]               = useState('');
  const [resumeStatus, setResumeStatus]           = useState(null);
  // 'idle' | 'parsing' | 'failed' | 'done'
  // Driven only by explicit actions — never overwritten by raw DB poll data
  const [parseUIState, setParseUIState]           = useState('idle');
  const [uploading, setUploading]                 = useState(false);
  const picInputRef                               = useRef(null);
  const pollRef                                   = useRef(null);
  const pollStart                                 = useRef(null);

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      profilesAPI.getCandidate(),
      profilesAPI.getResumeStatus(),
    ]).then(([{ data: profile }, { data: rs }]) => {
      if (profile) {
        setForm({
          headline:           profile.headline            || '',
          bio:                profile.bio                 || '',
          skills:             profile.skills              || [],
          experience_years:   profile.experience_years    || '',
          desired_job_title:  profile.desired_job_title   || '',
          preferred_category: profile.preferred_category  || '',
          preferred_job_type:  profile.preferred_job_type   || '',
          preferred_location: profile.preferred_location  || '',
          desired_salary:     profile.desired_salary      || '',
          linkedin_url:       profile.linkedin_url        || '',
          github_url:         profile.github_url          || '',
          portfolio_url:      profile.portfolio_url       || '',
          is_open_to_work:    profile.is_open_to_work     ?? true,
          // If Gemini stored education/experience as JSONB arrays, convert to
          // readable text for the textarea instead of raw JSON
          education:  formatTextareaField(profile.education),
          experience: formatTextareaField(profile.experience),
          // New fields — phone stored as-is, no stripping
          phone_number:  profile.phone_number  || '',
          date_of_birth: profile.date_of_birth || '',
          gender:        profile.gender        || '',
          lives_in:      profile.lives_in      || '',
        });
        setProfilePicture(profile.profile_picture || null);
      }
      setResumeStatus(rs);
      if (rs?.resume_url && !rs?.resume_parsed) {
        setParseUIState('parsing');
        startPolling();
      } else if (rs?.resume_parsed) {
        setParseUIState('done');
      }
    }).catch(console.error).finally(() => setLoading(false));

  return () => stopPolling();
  }, []); // eslint-disable-line

  // ── Polling ─────────────────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = () => {
    stopPolling();
    pollStart.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStart.current > 120000) {
        stopPolling();
        setParseUIState('failed');
        toast.error('Parsing is taking longer than expected. Please re-upload.');
        return;
      }
      try {
        const { data: rs } = await profilesAPI.getResumeStatus();

        // Still parsing — keep spinner, don't change parseUIState
        if (!rs?.resume_parsed) { setResumeStatus(rs); return; }

        // Success
        stopPolling();
        setParseUIState('done');
        setResumeStatus(rs);
        await new Promise(r => setTimeout(r, 1000));
        const { data: profile } = await profilesAPI.getCandidate();
        if (!profile) return;
        toast.success('Resume parsed! Profile updated ✨');
        setForm(prev => ({
          ...prev,
          headline:         profile.headline            || prev.headline,
          bio:              profile.bio                 || prev.bio,
          skills:           profile.skills?.length      ? profile.skills : prev.skills,
          experience_years: profile.experience_years    != null ? profile.experience_years : prev.experience_years,
          desired_job_title:  profile.desired_job_title  || prev.desired_job_title,
          preferred_category: profile.preferred_category || prev.preferred_category,
          preferred_job_type:  profile.preferred_job_type  || prev.preferred_job_type,
          preferred_location: profile.preferred_location || prev.preferred_location,
          desired_salary:     profile.desired_salary     || prev.desired_salary,
          linkedin_url:       profile.linkedin_url       || prev.linkedin_url,
          github_url:         profile.github_url         || prev.github_url,
          portfolio_url:      profile.portfolio_url      || prev.portfolio_url,
          education:  profile.education  ? formatTextareaField(profile.education)  : prev.education,
          experience: profile.experience ? formatTextareaField(profile.experience) : prev.experience,
          lives_in:      profile.lives_in      || prev.lives_in,
          phone_number:  profile.phone_number  || prev.phone_number,
          date_of_birth: profile.date_of_birth || prev.date_of_birth,
          gender:        profile.gender        || prev.gender,
        }));
      } catch (e) { console.error('Poll error:', e); }
    }, 3000);
  };

  // ── Profile picture upload ───────────────────────────────────────────────────
  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview instantly
    const preview = URL.createObjectURL(file);
    setProfilePicture(preview);
    setUploadingPic(true);

    try {
      // 1. Get presigned URL from backend
      const { data: { uploadUrl, publicUrl } } = await profilesAPI.getPictureUploadUrl({
        filename:     file.name,
        content_type: file.type,
      });

      // 2. Upload directly to R2
      await fetch(uploadUrl, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': file.type },
      });

      // 3. Save the public URL to the DB
      await profilesAPI.confirmPictureUpload({ profile_picture_url: publicUrl });

      setProfilePicture(publicUrl);
      updateUser({ profile_picture: publicUrl });
      toast.success('Profile photo updated!');
    } catch (err) {
      console.error(err);
      setProfilePicture(null);
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPic(false);
    }
  };

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const addSkill = (skill) => {
    const s = skill.trim();
    if (s && !form.skills.includes(s)) set('skills', [...form.skills, s]);
    setSkillInput('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await profilesAPI.updateCandidate({ ...form });
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // ── Resume drop ──────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { uploadUrl, publicUrl } } = await profilesAPI.getUploadUrl({
        filename:     file.name,
        content_type: file.type,
      });
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await profilesAPI.confirmUpload({ resume_url: publicUrl, filename: file.name });
      setParseUIState('parsing');   // ← immediately show spinner, ignore DB state
      setResumeStatus(p => ({
        ...p,
        resume_url:    publicUrl,
        resume_parsed: false,
      }));
      toast.success('Resume uploaded! Parsing in progress...');
      startPolling();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  }, []); // eslint-disable-line

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await authAPI.deleteAccount();
      logout();
      navigate('/');
      toast.success('Your account has been deleted.');
    } catch {
      toast.error('Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-28" />)}
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white">My Profile</h1>
          <p className="text-slate-400 mt-1">Keep your profile updated for better matches</p>
        </div>

        {/* ── Account Info ── */}
        <div className="card mb-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{user?.name || user?.full_name || 'No name set'}</p>
            <p className="text-sm text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        {/* ── Profile Photo ── */}
        <div className="card mb-6">
          <h2 className="font-semibold text-white mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5">
            {/* Avatar circle */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-dark-500 border-2 border-dark-300 flex items-center justify-center">
                {uploadingPic ? (
                  <Loader size={24} className="text-brand-400 animate-spin" />
                ) : profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-slate-600" />
                )}
              </div>
              {/* Camera overlay button */}
              <button
                type="button"
                onClick={() => picInputRef.current?.click()}
                disabled={uploadingPic}
                className="absolute bottom-0 right-0 w-7 h-7 bg-brand-500 hover:bg-brand-400 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
              >
                <Camera size={13} className="text-dark-900" />
              </button>
              <input
                ref={picInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePictureChange}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-white">
                {profilePicture ? 'Change photo' : 'Upload a photo'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">JPG, PNG or WEBP · Max 5MB</p>
              <button
                type="button"
                onClick={() => picInputRef.current?.click()}
                disabled={uploadingPic}
                className="btn-secondary text-xs py-1.5 px-3 mt-2"
              >
                {uploadingPic ? 'Uploading...' : 'Choose Photo'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Open to Work ── */}
        <div className="card mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Open to Work</p>
            <p className="text-sm text-slate-400 mt-0.5">Let employers know you're available</p>
          </div>
          <button
            onClick={() => set('is_open_to_work', !form.is_open_to_work)}
            className={`relative w-14 h-7 rounded-full transition-colors ${form.is_open_to_work ? 'bg-emerald-500' : 'bg-dark-400'}`}
          >
            <span className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all ${form.is_open_to_work ? 'left-8' : 'left-1.5'}`} />
          </button>
        </div>

        {/* ── Resume Upload ── */}
        <div className="card mb-6">
          <h2 className="font-semibold text-white mb-4">Resume</h2>
          {resumeStatus?.resume_url && (
            <div className="flex items-center gap-3 p-4 bg-dark-600 rounded-xl mb-3">
              <FileText size={24} className="text-brand-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Resume uploaded</p>
                {parseUIState === 'done' ? (
                  <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                    <CheckCircle size={11} /> Parsed successfully
                  </p>
                ) : parseUIState === 'failed' ? (
                  <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                    ⚠ Parsing failed. Please re-upload your resume.
                  </p>
                ) : (
                  <p className="text-xs text-brand-400 flex items-center gap-1 mt-0.5">
                    <><Loader size={11} className="animate-spin" /> Parsing in progress — updates automatically…</>
                    
                  </p>
                )}
              </div>
              <a href={resumeStatus.resume_url} target="_blank" rel="noreferrer"
                className="text-xs text-brand-400 hover:underline flex-shrink-0">View</a>
            </div>
          )}
          {!resumeStatus?.resume_url || parseUIState === 'done' || parseUIState === 'failed' ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragActive ? 'border-brand-500 bg-brand-500/5' : 'border-dark-400 hover:border-dark-300'
              }`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-brand-400">
                  <Loader size={32} className="animate-spin" />
                  <p className="text-sm">Uploading...</p>
                </div>
              ) : (
                <>
                  <Upload size={32} className="text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300 font-medium">
                    {isDragActive ? 'Drop here!' : resumeStatus?.resume_url ? 'Drop new resume to replace' : 'Drop your resume here'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">PDF or DOCX up to 10MB</p>
                </>
              )}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          {/* ── Personal Info (NEW FIELDS) ── */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white border-b border-dark-400 pb-3">Personal Info</h2>

            {/* Contact Number */}
            <div>
              <label className="label">Contact Number</label>
              <input
                type="tel"
                value={form.phone_number}
                onChange={e => set('phone_number', e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="input"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="label">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => set('date_of_birth', e.target.value)}
                className="input"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Gender */}
            <div>
              <label className="label">Gender</label>
              <select
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
                className="input"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Lives In */}
            <div>
              <label className="label">Lives In</label>
              <input
                type="text"
                value={form.lives_in}
                onChange={e => set('lives_in', e.target.value)}
                placeholder="e.g. Delhi, India  /  New York, USA"
                className="input"
              />
              <p className="text-xs text-slate-500 mt-1">City, State, Country</p>
            </div>
          </div>

          {/* ── Professional Info ── */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white border-b border-dark-400 pb-3">Professional Info</h2>
            <div>
              <label className="label">Professional Headline</label>
              <input value={form.headline} onChange={e => set('headline', e.target.value)}
                placeholder="e.g. Senior React Developer | 5+ years" className="input" />
            </div>
            <div>
              <label className="label">Bio</label>
              <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
                rows={4} placeholder="Tell employers about yourself..." className="input resize-none" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Years of Experience</label>
                <input type="number" value={form.experience_years}
                  onChange={e => set('experience_years', e.target.value)}
                  placeholder="5" className="input" min="0" max="50" />
              </div>
              <div>
                <label className="label">Desired Job Title</label>
                <input value={form.desired_job_title}
                  onChange={e => set('desired_job_title', e.target.value)}
                  placeholder="Senior Developer" className="input" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Preferred Category</label>
                <select value={form.preferred_category}
                  onChange={e => set('preferred_category', e.target.value)}
                  className="input">
                  <option value="">Select a category</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Preferred Job Type</label>
                <select value={form.preferred_job_type}
                  onChange={e => set('preferred_job_type', e.target.value)}
                  className="input">
                  <option value="">Select job type</option>
                  {JOB_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Preferred Location</label>
                <input value={form.preferred_location}
                  onChange={e => set('preferred_location', e.target.value)}
                  placeholder="New York / Remote" className="input" />
              </div>
              <div>
                <label className="label">Expected Salary (USD/yr)</label>
                <input type="number" value={form.desired_salary || ''}
                  onChange={e => set('desired_salary', e.target.value)}
                  placeholder="100000" className="input" />
              </div>
            </div>
          </div>

          {/* ── Skills ── */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white border-b border-dark-400 pb-3">Skills</h2>
            <div className="flex gap-2">
              <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); } }}
                placeholder="Type skill and press Enter..." className="input flex-1" />
              <button type="button" onClick={() => addSkill(skillInput)} className="btn-secondary px-4">
                <Plus size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMMON_SKILLS.filter(s => !form.skills.includes(s)).slice(0, 8).map(s => (
                <button key={s} type="button" onClick={() => addSkill(s)}
                  className="badge bg-dark-500 text-slate-400 border border-dark-300 hover:border-brand-500/50 hover:text-brand-400 transition-colors">
                  + {s}
                </button>
              ))}
            </div>
            {form.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-dark-400">
                {form.skills.map(s => (
                  <span key={s} className="badge bg-brand-500/10 text-brand-400 border border-brand-500/30 flex items-center gap-1">
                    {s}
                    <button type="button" onClick={() => set('skills', form.skills.filter(x => x !== s))} className="hover:text-red-400">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Background ── */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white border-b border-dark-400 pb-3">Background</h2>
            <div>
              <label className="label">Education</label>
              <textarea value={form.education} onChange={e => set('education', e.target.value)}
                rows={3} placeholder="B.S. Computer Science, MIT, 2019..." className="input resize-none" />
            </div>
            <div>
              <label className="label">Work Experience</label>
              <textarea value={form.experience} onChange={e => set('experience', e.target.value)}
                rows={5} placeholder="Senior Developer @ Google (2021–Present)..." className="input resize-none" />
            </div>
          </div>

          {/* ── Links ── */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white border-b border-dark-400 pb-3">Links</h2>
            {[
              { key: 'linkedin_url',  label: 'LinkedIn',  placeholder: 'https://linkedin.com/in/you' },
              { key: 'github_url',    label: 'GitHub',    placeholder: 'https://github.com/you' },
              { key: 'portfolio_url', label: 'Portfolio', placeholder: 'https://yoursite.com' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input value={form[key]} onChange={e => set(key, e.target.value)}
                  placeholder={placeholder} className="input" type="url" />
              </div>
            ))}
          </div>

          <div className="flex justify-end pb-8">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* ── Danger Zone ── */}
        <div className="card border border-red-500/20 bg-red-500/5 space-y-3 mb-8">
          <h2 className="font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle size={16} /> Danger Zone
          </h2>
          <p className="text-sm text-slate-400">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/10 hover:border-red-500/60 transition-all"
          >
            <Trash2 size={15} /> Delete Account
          </button>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md space-y-5 border border-red-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Delete Account</h3>
                <p className="text-xs text-slate-500">This cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete your account? All your profile data,
              applications, and saved jobs will be <span className="text-red-400 font-medium">deleted forever</span>.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-dark-300 text-slate-300 text-sm font-medium hover:border-dark-200 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/25 hover:border-red-500/60 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <><Loader size={14} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Yes, Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}