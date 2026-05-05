import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, DollarSign, Users, Briefcase, Globe, ChevronLeft, CheckCircle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navbar from '../components/common/Navbar';
import { jobsAPI, applicationsAPI, profilesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function JobDetailPage() {
  const { id } = useParams();
  const { user, isCandidate } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    const fetches = [jobsAPI.getJob(id)];
    if (isCandidate) fetches.push(applicationsAPI.getMine());

    Promise.all(fetches)
      .then(([{ data: jobData }, appsRes]) => {
        setJob(jobData);
        if (appsRes) {
          const alreadyApplied = appsRes.data.some((a) => a.job_id === id);
          setApplied(alreadyApplied);
        }
      })
      .catch(() => toast.error('Job not found'))
      .finally(() => setLoading(false));
  }, [id, isCandidate]);

  const handleApply = async () => {
    if (!user) { navigate('/login'); return; }
    if (!isCandidate) { toast.error('Only candidates can apply'); return; }
    setApplying(true);
    try {
      await applicationsAPI.apply({ job_id: id, cover_letter: coverLetter });
      setApplied(true);
      setShowModal(false);
      toast.success('Application submitted!');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to apply';
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="card animate-pulse space-y-4">
          <div className="h-8 bg-dark-500 rounded w-64" />
          <div className="h-4 bg-dark-500 rounded w-48" />
          <div className="h-4 bg-dark-500 rounded w-full" />
          <div className="h-4 bg-dark-500 rounded w-full" />
        </div>
      </div>
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="font-display text-2xl text-white">Job not found</h2>
        <Link to="/jobs" className="btn-primary mt-6 inline-block">Browse Jobs</Link>
      </div>
    </div>
  );

  const company = job.employer_profiles;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        //Back 
        <Link to="/jobs" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm">
          <ChevronLeft size={16} /> Back to Jobs
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          //Main Content 
          <div className="lg:col-span-2 space-y-6">
            //Header 
            <div className="card">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-dark-500 border border-dark-300 rounded-2xl flex items-center justify-center text-2xl font-bold text-brand-400 flex-shrink-0">
                  {company?.company_logo ? (
                    <img src={company.company_logo} alt={company.company_name} className="w-full h-full object-cover rounded-2xl" />
                  ) : company?.company_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <h1 className="font-display text-2xl font-bold text-white">{job.title}</h1>
                  <p className="text-brand-400 font-medium mt-1">{company?.company_name}</p>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-400">
                    {job.location && <span className="flex items-center gap-1"><MapPin size={14} />{job.location}</span>}
                    {job.job_type && <span className="flex items-center gap-1 capitalize"><Briefcase size={14} />{job.job_type}</span>}
                    {(job.salary_min || job.salary_max) && (
                      <span className="flex items-center gap-1">
                        <DollarSign size={14} />
                        {job.salary_min && `$${(job.salary_min / 1000).toFixed(0)}k`}
                        {job.salary_min && job.salary_max && ' – '}
                        {job.salary_max && `$${(job.salary_max / 1000).toFixed(0)}k`}
                      </span>
                    )}
                    <span className="flex items-center gap-1"><Clock size={14} />{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {job.job_type && <span className="badge-green capitalize">{job.job_type}</span>}
                    {job.experience_level && <span className="badge-blue capitalize">{job.experience_level} level</span>}
                    {job.is_remote && <span className="badge-gold">Remote</span>}
                    {job.category && <span className="badge bg-dark-500 text-slate-400 border border-dark-300 capitalize">{job.category}</span>}
                  </div>
                </div>
              </div>
            </div>

            //Description 
            <div className="card">
              <h2 className="font-display text-xl font-bold text-white mb-4">Job Description</h2>
              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">{job.description}</div>
            </div>

            //Requirements 
            {job.requirements && (
              <div className="card">
                <h2 className="font-display text-xl font-bold text-white mb-4">Requirements</h2>
                <div className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">{job.requirements}</div>
              </div>
            )}

            //Skills 
            {job.skills?.length > 0 && (
              <div className="card">
                <h2 className="font-display text-xl font-bold text-white mb-4">Required Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span key={skill} className="badge bg-brand-500/10 text-brand-400 border border-brand-500/30 px-3 py-1">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          //Sidebar 
          <div className="space-y-4">
            //Apply Card 
            <div className="card sticky top-24">
              {applied ? (
                <div className="text-center py-4">
                  <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                  <p className="font-semibold text-white">Already Applied</p>
                  <p className="text-sm text-slate-400 mt-1">We'll notify you of any updates.</p>
                  <button disabled className="btn-primary w-full mt-4 flex items-center justify-center gap-2 opacity-70 cursor-not-allowed">
                    <CheckCircle size={16} /> Applied
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-white mb-4">Apply for this role</h3>
                  {isCandidate ? (
                    <button onClick={() => setShowModal(true)} className="btn-primary w-full">
                      Apply Now
                    </button>
                  ) : user ? (
                    <p className="text-sm text-slate-400 text-center">Only candidates can apply</p>
                  ) : (
                    <Link to="/login" className="btn-primary w-full text-center block">
                      Log In to Apply
                    </Link>
                  )}
                  {job.application_deadline && (
                    <p className="text-xs text-slate-500 text-center mt-3">
                      Deadline: {new Date(job.application_deadline).toLocaleDateString()}
                    </p>
                  )}
                </>
              )}
            </div>

            //Company Info 
            {company && (
              <div className="card">
                <h3 className="font-semibold text-white mb-4">About the Company</h3>
                <div className="space-y-3 text-sm text-slate-400">
                  {company.company_name && <p className="text-white font-medium">{company.company_name}</p>}
                  {company.industry && <p>🏢 {company.industry}</p>}
                  {company.company_size && <p><Users size={12} className="inline mr-1" />{company.company_size} employees</p>}
                  {company.headquarters && <p><MapPin size={12} className="inline mr-1" />{company.headquarters}</p>}
                  {company.company_website && (
                    <a href={company.company_website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-400 hover:underline">
                      <Globe size={12} /> Website
                    </a>
                  )}
                  {company.company_description && (
                    <p className="text-slate-400 text-xs leading-relaxed pt-2 border-t border-dark-400">
                      {company.company_description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      //Apply Modal 
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-dark-700 border border-dark-400 rounded-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-bold text-white">Apply for {job.title}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div>
              <label className="label">Cover Letter (optional)</label>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={6}
                placeholder="Tell the employer why you're a great fit for this role..."
                className="input resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">Your resume will be automatically attached from your profile.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleApply} disabled={applying} className="btn-primary flex-1">
                {applying ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
