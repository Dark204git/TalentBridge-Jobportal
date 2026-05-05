import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ChevronLeft } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { jobsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'freelance', 'internship'];
const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'lead', 'executive'];
const CATEGORIES = ['Technology', 'Finance', 'Design', 'Marketing', 'Healthcare', 'Legal', 'Education', 'Engineering', 'Sales', 'HR', 'Other'];
const COMMON_SKILLS = ['JavaScript', 'React', 'Node.js', 'Python', 'TypeScript', 'SQL', 'AWS', 'Docker', 'Git', 'Java', 'C++', 'Go', 'Figma', 'Photoshop', 'Excel', 'Project Management'];

const defaultForm = {
  title: '', description: '', requirements: '', location: '',
  job_type: 'full-time', experience_level: 'mid', category: 'Technology',
  salary_min: '', salary_max: '', is_remote: false, application_deadline: '',
  skills: [],
};

export default function PostJob() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [form, setForm] = useState(defaultForm);
  const [skillInput, setSkillInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing) {
      jobsAPI.getJob(id)
        .then(({ data }) => setForm({
          title: data.title || '', description: data.description || '',
          requirements: data.requirements || '', location: data.location || '',
          job_type: data.job_type || 'full-time', experience_level: data.experience_level || 'mid',
          category: data.category || 'Technology', salary_min: data.salary_min || '',
          salary_max: data.salary_max || '', is_remote: data.is_remote || false,
          application_deadline: data.application_deadline ? data.application_deadline.split('T')[0] : '',
          skills: data.skills || [],
        }))
        .catch(() => toast.error('Failed to load job'));
    }
  }, [id, isEditing]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const addSkill = (skill) => {
    const s = skill.trim();
    if (s && !form.skills.includes(s)) {
      set('skills', [...form.skills, s]);
    }
    setSkillInput('');
  };

  const removeSkill = (s) => set('skills', form.skills.filter((x) => x !== s));

  const handleSkillKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) { toast.error('Title and description are required'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        salary_min: form.salary_min ? parseInt(form.salary_min) : null,
        salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      };
      if (isEditing) {
        await jobsAPI.updateJob(id, payload);
        toast.success('Job updated!');
      } else {
        await jobsAPI.createJob(payload);
        toast.success('Job posted! 🎉');
      }
      navigate('/employer/jobs');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white hover:bg-dark-500 rounded-lg transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-3xl font-bold text-white">{isEditing ? 'Edit Job' : 'Post a New Job'}</h1>
            <p className="text-slate-400 mt-1">{isEditing ? 'Update your job listing' : 'Reach thousands of qualified candidates'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          //Basic Info 
          <div className="card space-y-5">
            <h2 className="font-semibold text-white text-lg border-b border-dark-400 pb-3">Basic Information</h2>
            <div>
              <label className="label">Job Title *</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Senior React Developer" className="input" required />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Job Type</label>
                <select value={form.job_type} onChange={(e) => set('job_type', e.target.value)} className="input capitalize">
                  {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Experience Level</label>
                <select value={form.experience_level} onChange={(e) => set('experience_level', e.target.value)} className="input capitalize">
                  {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Location</label>
                <input value={form.location} onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. New York, NY" className="input" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => set('is_remote', !form.is_remote)}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.is_remote ? 'bg-brand-500' : 'bg-dark-400'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.is_remote ? 'left-7' : 'left-1'}`} />
              </button>
              <span className="text-sm text-slate-300">Remote position</span>
            </div>
          </div>

          //Salary 
          <div className="card space-y-4">
            <h2 className="font-semibold text-white text-lg border-b border-dark-400 pb-3">Compensation</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Salary Min (USD/year)</label>
                <input type="number" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)}
                  placeholder="e.g. 80000" className="input" min="0" />
              </div>
              <div>
                <label className="label">Salary Max (USD/year)</label>
                <input type="number" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)}
                  placeholder="e.g. 120000" className="input" min="0" />
              </div>
            </div>
            <div>
              <label className="label">Application Deadline</label>
              <input type="date" value={form.application_deadline} onChange={(e) => set('application_deadline', e.target.value)}
                className="input" min={new Date().toISOString().split('T')[0]} />
            </div>
          </div>

          //Description 
          <div className="card space-y-4">
            <h2 className="font-semibold text-white text-lg border-b border-dark-400 pb-3">Job Details</h2>
            <div>
              <label className="label">Job Description *</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                rows={8} placeholder="Describe the role, responsibilities, and what a typical day looks like..."
                className="input resize-none" required />
            </div>
            <div>
              <label className="label">Requirements</label>
              <textarea value={form.requirements} onChange={(e) => set('requirements', e.target.value)}
                rows={5} placeholder="List the qualifications, must-haves, and nice-to-haves..."
                className="input resize-none" />
            </div>
          </div>

          //Skills 
          <div className="card space-y-4">
            <h2 className="font-semibold text-white text-lg border-b border-dark-400 pb-3">Required Skills</h2>
            <div className="flex gap-2">
              <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKey}
                placeholder="Type a skill and press Enter..." className="input flex-1" />
              <button type="button" onClick={() => addSkill(skillInput)} className="btn-secondary px-4">
                <Plus size={18} />
              </button>
            </div>
            //Common skills 
            <div className="flex flex-wrap gap-2">
              {COMMON_SKILLS.filter((s) => !form.skills.includes(s)).slice(0, 8).map((s) => (
                <button key={s} type="button" onClick={() => addSkill(s)}
                  className="badge bg-dark-500 text-slate-400 border border-dark-300 hover:border-brand-500/50 hover:text-brand-400 transition-colors cursor-pointer">
                  + {s}
                </button>
              ))}
            </div>
            {form.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-dark-400">
                {form.skills.map((s) => (
                  <span key={s} className="badge bg-brand-500/10 text-brand-400 border border-brand-500/30 flex items-center gap-1 pr-1">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-400 ml-1">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-end pb-8">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary min-w-32">
              {loading ? 'Saving...' : isEditing ? 'Update Job' : 'Post Job 🚀'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
