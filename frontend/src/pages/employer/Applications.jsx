import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText, Mail, ExternalLink, Filter, Download,
  Phone, Calendar, User2, MapPin, Briefcase,
  Github, Linkedin, Globe, AlertCircle, Zap,
  Trash2, X, CheckCircle, XCircle, Loader2, ChevronRight,
} from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { applicationsAPI, jobsAPI } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUSES = ['pending', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected'];

const statusColors = {
  pending:     'bg-[rgba(148,163,184,0.18)] text-[rgba(255,255,255,0.75)] border border-[rgba(148,163,184,0.35)]',
  reviewing:   'bg-[rgba(99,102,241,0.22)]  text-[#a5b4fc]               border border-[rgba(99,102,241,0.40)]',
  shortlisted: 'bg-[rgba(212,168,67,0.18)]  text-[#d4a843]               border border-[rgba(212,168,67,0.38)]',
  interviewed: 'bg-[rgba(139,132,255,0.20)] text-[#c4b5fd]               border border-[rgba(139,132,255,0.38)]',
  offered:     'bg-[rgba(0,200,150,0.18)]   text-[#00c896]               border border-[rgba(0,200,150,0.35)]',
  rejected:    'bg-[rgba(255,107,107,0.18)] text-[#ff6b6b]               border border-[rgba(255,107,107,0.35)]',
};

function formatDOB(dob) {
  if (!dob) return null;
  try {
    return new Date(dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dob; }
}

// ── Auto-Screen Confirmation Modal ───────────────────────────────────────────
function AutoScreenModal({ pendingCount, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#07070f] border border-[rgba(255,255,255,0.10)] rounded-[14px] p-5 max-w-md w-full space-y-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(212,168,67,0.14)] border border-[rgba(212,168,67,0.28)] flex items-center justify-center flex-shrink-0">
            <Zap size={18} className="text-[#d4a843]" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">Auto-Screen Applications</h3>
            <p className="text-sm text-[rgba(255,255,255,0.50)] mt-0.5">Across all your jobs</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.75)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="bg-[#0d0d1c] rounded-xl p-4 space-y-3 text-sm border border-[rgba(255,255,255,0.06)]">
          <p className="text-[rgba(255,255,255,0.75)]">
            This will analyse <span className="text-white font-medium">{pendingCount} pending application{pendingCount !== 1 ? 's' : ''}</span> across all your jobs using AI match scores.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle size={14} />
              <span><span className="font-medium">≥ 40% match</span> → moved to <span className="font-medium">Reviewing</span></span>
            </div>
            <div className="flex items-center gap-2 text-red-400">
              <XCircle size={14} />
              <span><span className="font-medium">&lt; 40% match</span> → moved to <span className="font-medium">Rejected</span></span>
            </div>
          </div>
          <p className="text-[rgba(255,255,255,0.35)] text-xs border-t border-[rgba(255,255,255,0.08)] pt-3">
            Only <span className="text-[rgba(255,255,255,0.50)]">pending</span> applications are screened. Others are not affected.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.75)] text-sm font-medium hover:border-[rgba(255,255,255,0.20)] transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#e8c06a] text-[#07070f] text-sm font-medium transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Screening…</> : <><Zap size={14} /> Run Auto-Screen</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Auto-Screen Results Modal ─────────────────────────────────────────────────
function ScreenResultsModal({ results, onClose }) {
  const { screened, reviewing, rejected, threshold } = results;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#07070f] border border-[rgba(255,255,255,0.10)] rounded-[14px] p-5 max-w-sm w-full space-y-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle size={18} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Screening Complete</h3>
            <p className="text-xs text-[rgba(255,255,255,0.50)]">{screened} applications processed</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{reviewing}</p>
            <p className="text-xs text-emerald-400/70 mt-1">Moved to Reviewing</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5">≥ {threshold}% match</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{rejected}</p>
            <p className="text-xs text-red-400/70 mt-1">Rejected</p>
            <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-0.5">&lt; {threshold}% match</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-full px-4 py-2.5 rounded-xl bg-[#13132a] border border-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.75)] text-sm font-medium hover:border-[rgba(255,255,255,0.20)] transition-all">
          Done
        </button>
      </div>
    </div>
  );
}

// ── Candidate Detail Panel (shared by desktop + drawer) ───────────────────────
function CandidateDetail({ selectedApp, updating, deleting, onUpdateStatus, onDelete }) {
  const p = selectedApp.candidate_profiles;

  const infoItems = p ? [
    p.phone_number && {
      icon: <Phone size={13} className="text-[#d4a843] flex-shrink-0 mt-0.5" />,
      label: 'Contact Number',
      value: <a href={`tel:${p.phone_number}`} className="text-white hover:text-[#d4a843] transition-colors">{p.phone_number}</a>,
    },
    p.date_of_birth && {
      icon: <Calendar size={13} className="text-[#d4a843] flex-shrink-0 mt-0.5" />,
      label: 'Date of Birth',
      value: <span className="text-white">{formatDOB(p.date_of_birth)}</span>,
    },
    p.gender && {
      icon: <User2 size={13} className="text-[#d4a843] flex-shrink-0 mt-0.5" />,
      label: 'Gender',
      value: <span className="text-white capitalize">{p.gender}</span>,
    },
    p.lives_in && {
      icon: <MapPin size={13} className="text-[#d4a843] flex-shrink-0 mt-0.5" />,
      label: 'Lives In',
      value: <span className="text-white">{p.lives_in}</span>,
    },
    (p.experience_years != null) && {
      icon: <Briefcase size={13} className="text-[#d4a843] flex-shrink-0 mt-0.5" />,
      label: 'Experience',
      value: <span className="text-white">{p.experience_years} {p.experience_years === 1 ? 'year' : 'years'}</span>,
    },
  ].filter(Boolean) : [];

  const links = p ? [
    p.linkedin_url  && { icon: <Linkedin size={13} />, label: 'LinkedIn',  url: p.linkedin_url },
    p.github_url    && { icon: <Github size={13} />,   label: 'GitHub',    url: p.github_url },
    p.portfolio_url && { icon: <Globe size={13} />,    label: 'Portfolio', url: p.portfolio_url },
  ].filter(Boolean) : [];

  const resumeUrl = p?.resume_url || selectedApp.resume_url || null;
  const resumeFilename = p?.resume_filename
    || `${(selectedApp.users?.full_name || 'candidate').replace(/\s+/g, '_')}_resume.pdf`;

  return (
    <div className="space-y-5">
      {/* Candidate header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-[#1a1a35] border border-[rgba(255,255,255,0.10)] rounded-full flex items-center justify-center text-xl font-bold text-[#d4a843] overflow-hidden flex-shrink-0">
          {p?.profile_picture
            ? <img src={p.profile_picture} alt="" className="w-full h-full object-cover" />
            : selectedApp.users?.full_name?.[0]?.toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-white text-lg leading-tight">{selectedApp.users?.full_name}</h3>
            {selectedApp.match_score != null && (
              <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${
                selectedApp.match_score >= 40
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'bg-red-500/15 text-red-400 border border-red-500/25'
              }`}>
                {selectedApp.match_score}% match
              </span>
            )}
          </div>
          <a href={`mailto:${selectedApp.users?.email}`}
            className="flex items-center gap-1 text-sm text-[#d4a843] hover:underline mt-0.5 truncate">
            <Mail size={12} className="flex-shrink-0" /> {selectedApp.users?.email}
          </a>
          {p?.headline && (
            <p className="text-sm text-[rgba(255,255,255,0.50)] mt-1">{p.headline}</p>
          )}
          {selectedApp.jobs?.title && (
            <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg bg-[rgba(212,168,67,0.10)] border border-[rgba(212,168,67,0.22)] w-fit max-w-full">
              <Briefcase size={12} className="text-[#d4a843] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-[rgba(212,168,67,0.65)] leading-none mb-0.5">Applied for</p>
                <p className="text-xs font-medium text-[#e8c06a] truncate">{selectedApp.jobs.title}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info grid */}
      {(infoItems.length > 0 || links.length > 0 || p?.skills?.length > 0) && (
        <div className="bg-[#0d0d1c] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 space-y-4 text-sm">
          {infoItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
              {infoItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  {item.icon}
                  <div className="min-w-0">
                    <p className="text-[rgba(255,255,255,0.35)] text-xs">{item.label}</p>
                    <div className="truncate">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {p?.skills?.length > 0 && (
            <div>
              <p className="text-[rgba(255,255,255,0.35)] text-xs mb-1.5">Skills</p>
              <div className="flex flex-wrap gap-1">
                {p.skills.slice(0, 10).map(s => (
                  <span key={s} className="badge bg-[#1a1a35] text-[rgba(255,255,255,0.75)] text-xs">{s}</span>
                ))}
                {p.skills.length > 10 && (
                  <span className="badge bg-[#1a1a35] text-[rgba(255,255,255,0.35)] text-xs">+{p.skills.length - 10} more</span>
                )}
              </div>
            </div>
          )}
          {links.length > 0 && (
            <div>
              <p className="text-[rgba(255,255,255,0.35)] text-xs mb-1.5">Links</p>
              <div className="flex flex-wrap gap-3">
                {links.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#d4a843] hover:text-[#e8c06a] transition-colors">
                    {link.icon} {link.label} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cover Letter */}
      {selectedApp.cover_letter && (
        <div>
          <p className="text-xs font-medium text-[rgba(255,255,255,0.50)] uppercase tracking-wider mb-2">Cover Letter</p>
          <div className="bg-[#0d0d1c] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-sm text-[rgba(255,255,255,0.75)] leading-relaxed max-h-48 overflow-y-auto">
            {selectedApp.cover_letter}
          </div>
        </div>
      )}

      {/* Resume */}
      <div>
        <p className="text-xs font-medium text-[rgba(255,255,255,0.50)] uppercase tracking-wider mb-2">Resume</p>
        {resumeUrl ? (
          <div className="flex items-center gap-3 flex-wrap">
            <a href={resumeUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d0d1c] border border-[rgba(255,255,255,0.10)] text-sm text-[#d4a843] hover:text-[#e8c06a] hover:border-[rgba(255,255,255,0.20)] transition-all">
              <FileText size={15} /> View Resume <ExternalLink size={11} />
            </a>
            <a href={resumeUrl} download={resumeFilename}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(212,168,67,0.12)] border border-[rgba(212,168,67,0.28)] text-sm text-[#d4a843] hover:bg-[rgba(212,168,67,0.20)] hover:border-[rgba(212,168,67,0.45)] transition-all">
              <Download size={15} /> Download
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#0d0d1c] border border-[rgba(255,255,255,0.08)] text-sm text-[rgba(255,255,255,0.35)] w-fit">
            <AlertCircle size={14} className="text-[rgba(255,255,255,0.25)]" /> Resume not available
          </div>
        )}
      </div>

      {/* Status Update */}
      <div className="border-t border-[rgba(255,255,255,0.08)] pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-[rgba(255,255,255,0.50)] uppercase tracking-wider">Update Status</p>
          {selectedApp.status === 'rejected' && (
            <button
              onClick={() => onDelete(selectedApp.id)}
              disabled={deleting === selectedApp.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#ff6b6b] border border-[rgba(255,107,107,0.28)] bg-[rgba(255,107,107,0.10)] hover:bg-[rgba(255,107,107,0.20)] transition-all disabled:opacity-50"
            >
              {deleting === selectedApp.id
                ? <><Loader2 size={11} className="animate-spin" /> Removing…</>
                : <><Trash2 size={11} /> Remove Application</>
              }
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => onUpdateStatus(selectedApp.id, s)}
              disabled={updating === selectedApp.id || selectedApp.status === s}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border ${
                selectedApp.status === s
                  ? `${statusColors[s]} border-current`
                  : 'border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.45)] hover:border-[rgba(255,255,255,0.25)] hover:text-white'
              } disabled:opacity-50`}
            >
              {updating === selectedApp.id ? '…' : s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployerApplications() {
  const [searchParams] = useSearchParams();
  const preselectedJob = searchParams.get('job');

  const [jobs, setJobs]                 = useState([]);
  const [selectedJob, setSelectedJob]   = useState(preselectedJob || '');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [updating, setUpdating]         = useState(null);
  const [selectedApp, setSelectedApp]   = useState(null);
  const [deleting, setDeleting]         = useState(null);

  const [showScreenModal, setShowScreenModal] = useState(false);
  const [screenLoading, setScreenLoading]     = useState(false);
  const [screenResults, setScreenResults]     = useState(null);

  // Close drawer on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedApp(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (selectedApp) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedApp]);

  useEffect(() => {
    jobsAPI.getMyJobs().then(({ data }) => setJobs(data)).catch(console.error);
  }, []);

  const fetchApplications = useCallback(async () => {
    if (jobs.length === 0) return;
    setLoading(true);
    setSelectedApp(null);
    try {
      if (selectedJob) {
        const { data } = await applicationsAPI.getForJob(selectedJob);
        setApplications(data);
      } else {
        const results = await Promise.all(
          jobs.map(j => applicationsAPI.getForJob(j.id).then(r => r.data).catch(() => []))
        );
        setApplications(results.flat());
      }
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [selectedJob, jobs]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const updateStatus = async (appId, status) => {
    setUpdating(appId);
    try {
      await applicationsAPI.updateStatus(appId, { status });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
      if (selectedApp?.id === appId) setSelectedApp(p => ({ ...p, status }));
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (appId) => {
    setDeleting(appId);
    try {
      await applicationsAPI.deleteApplication(appId);
      setApplications(prev => prev.filter(a => a.id !== appId));
      if (selectedApp?.id === appId) setSelectedApp(null);
      toast.success('Application removed');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete application');
    } finally {
      setDeleting(null);
    }
  };

  const handleAutoScreen = async () => {
    setScreenLoading(true);
    try {
      const { data } = await applicationsAPI.autoScreenAll();
      setScreenResults(data);
      setShowScreenModal(false);
      await fetchApplications();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Auto-screen failed');
      setShowScreenModal(false);
    } finally {
      setScreenLoading(false);
    }
  };

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.status === s);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">

        {showScreenModal && (
          <AutoScreenModal
            pendingCount={pendingCount}
            onConfirm={handleAutoScreen}
            onCancel={() => setShowScreenModal(false)}
            loading={screenLoading}
          />
        )}
        {screenResults && (
          <ScreenResultsModal results={screenResults} onClose={() => setScreenResults(null)} />
        )}

        {/* ── Mobile drawer overlay (hidden on lg+) ── */}
        <div className={`lg:hidden fixed inset-0 z-40 ${selectedApp ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${selectedApp ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setSelectedApp(null)}
          />
          {/* Drawer */}
          <div className={`absolute top-0 right-0 h-full w-full max-w-sm bg-[#07070f] border-l border-[rgba(255,255,255,0.09)] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${selectedApp ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Drawer header with close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.08)] bg-[#07070f] flex-shrink-0">
              <p className="font-semibold text-white text-sm">Applicant Details</p>
              <button
                onClick={() => setSelectedApp(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgba(255,255,255,0.45)] hover:text-white hover:bg-[rgba(255,255,255,0.07)] transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedApp && (
                <CandidateDetail
                  selectedApp={selectedApp}
                  updating={updating}
                  deleting={deleting}
                  onUpdateStatus={updateStatus}
                  onDelete={handleDelete}
                />
              )}
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Applications</h1>
            <p className="text-[rgba(255,255,255,0.50)] mt-1">{applications.length} total applications</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-3 flex-wrap">
            {pendingCount > 0 && (
              <button
                onClick={() => setShowScreenModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(212,168,67,0.10)] border border-[rgba(212,168,67,0.28)] text-sm font-medium text-[#d4a843] hover:bg-[rgba(212,168,67,0.20)] hover:border-[rgba(212,168,67,0.45)] transition-all"
              >
                <Zap size={15} />
                Auto-Screen
                <span className="px-1.5 py-0.5 rounded-md bg-[rgba(212,168,67,0.18)] text-[#e8c06a] text-xs font-bold">
                  {pendingCount}
                </span>
              </button>
            )}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-[rgba(255,255,255,0.35)]" />
              <select
                value={selectedJob}
                onChange={e => setSelectedJob(e.target.value)}
                className="input text-sm w-auto"
              >
                <option value="">All Jobs</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {STATUSES.map(s => (
            <div key={s} className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${statusColors[s]}`}>
              <span className="capitalize">{s}</span>
              <span className="font-bold">{grouped[s].length}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-4 items-start">

          {/* Application list */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="bg-[#0d0d1c] border border-[rgba(255,255,255,0.06)] rounded-[14px] animate-pulse h-20" />)
            ) : applications.length === 0 ? (
              <div className="bg-[#0d0d1c] border border-[rgba(255,255,255,0.06)] rounded-[14px] p-5 text-center py-12">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-[rgba(255,255,255,0.50)]">No applications yet</p>
              </div>
            ) : (
              applications.map(app => {
                const isSelected = selectedApp?.id === app.id;
                return (
                  <div key={app.id} className="relative">
                    <button
                      onClick={() => setSelectedApp(isSelected ? null : app)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        isSelected
                          ? 'border-[rgba(212,168,67,0.55)] bg-[#13132a] shadow-[0_0_0_3px_rgba(212,168,67,0.12)]'
                          : 'border-[rgba(255,255,255,0.07)] bg-[#0d0d1c] hover:border-[rgba(255,255,255,0.14)] hover:bg-[#13132a]'
                      } ${app.status === 'rejected' ? 'pr-12' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden border ${
                          isSelected ? 'border-[rgba(212,168,67,0.50)] bg-[rgba(212,168,67,0.10)] text-[#d4a843]' : 'border-[rgba(255,255,255,0.10)] bg-[#1a1a35] text-[#d4a843]'
                        }`}>
                          {app.candidate_profiles?.profile_picture
                            ? <img src={app.candidate_profiles.profile_picture} alt="" className="w-full h-full object-cover" />
                            : app.users?.full_name?.[0]?.toUpperCase()
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-medium text-sm truncate ${isSelected ? 'text-[#e8c06a]' : 'text-white'}`}>
                              {app.users?.full_name}
                            </p>
                            {/* Arrow hint on mobile */}
                            <ChevronRight size={14} className={`flex-shrink-0 lg:hidden transition-transform ${isSelected ? 'text-[#d4a843] rotate-90' : 'text-[rgba(255,255,255,0.20)]'}`} />
                          </div>
                          <p className="text-xs text-[rgba(255,255,255,0.50)] truncate">{app.users?.email}</p>
                          {app.jobs?.title && (
                            <p className="flex items-center gap-1 text-xs text-[rgba(212,168,67,0.75)] truncate mt-0.5">
                              Applied for: <Briefcase size={10} className="flex-shrink-0" /> {app.jobs.title}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`badge text-xs ${statusColors[app.status]}`}>{app.status}</span>
                            {app.match_score != null && (
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                                app.match_score >= 40
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-red-500/15 text-red-400'
                              }`}>
                                {app.match_score}% match
                              </span>
                            )}
                            <span className="text-xs text-[rgba(255,255,255,0.35)]">
                              {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Delete button for rejected apps */}
                    {app.status === 'rejected' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }}
                        disabled={deleting === app.id}
                        title="Remove rejected application"
                        className="absolute top-1/2 -translate-y-1/2 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-[#ff6b6b] bg-[rgba(255,107,107,0.10)] border border-[rgba(255,107,107,0.22)] hover:bg-[rgba(255,107,107,0.20)] transition-all disabled:opacity-50"
                      >
                        {deleting === app.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />
                        }
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop right panel (hidden on mobile — drawer handles it) */}
          <div className="hidden lg:block lg:col-span-3">
            {selectedApp ? (
              <div className="bg-[#07070f] border border-[rgba(255,255,255,0.09)] rounded-[14px] p-5 space-y-5 animate-fade-in">
                <CandidateDetail
                  selectedApp={selectedApp}
                  updating={updating}
                  deleting={deleting}
                  onUpdateStatus={updateStatus}
                  onDelete={handleDelete}
                />
              </div>
            ) : (
              <div className="bg-[#0d0d1c] border border-[rgba(255,255,255,0.06)] rounded-[14px] p-5 flex flex-col items-center justify-center py-16 text-center">
                <p className="text-4xl mb-3">👈</p>
                <p className="text-[rgba(255,255,255,0.50)]">Select an application to view details</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}