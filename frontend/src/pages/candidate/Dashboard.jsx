import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, FileText, Bookmark, TrendingUp, Search, Upload, Zap, XCircle, CheckCircle2, Clock, Star, MessageSquare } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { analyticsAPI, applicationsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import MatchedJobs from '../../components/MatchedJobs';

const statusColors = {
  pending: 'bg-slate-500/20 text-slate-400', reviewing: 'bg-blue-500/20 text-blue-400',
  shortlisted: 'bg-brand-500/20 text-brand-400', interviewed: 'bg-purple-500/20 text-purple-400',
  offered: 'bg-emerald-500/20 text-emerald-400', rejected: 'bg-red-500/20 text-red-400',
};

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [stats, setStats]           = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [allApps, setAllApps]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [aiMatchCount, setAiMatchCount]   = useState(null);
  const [rejectedCount, setRejectedCount] = useState(0);

  useEffect(() => {
    Promise.all([
      analyticsAPI.getCandidateStats(),
      applicationsAPI.getMine(),
    ])
      .then(([{ data: s }, { data: apps }]) => {
        setStats(s);
        setAllApps(apps);
        setRecentApps(apps.slice(0, 5));
        setRejectedCount(apps.filter(a => a.status === 'rejected').length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Pipeline computation ────────────────────────────────────────────────────
  const PIPELINE_STAGES = [
    { key: 'pending',     label: 'Applied',      color: 'bg-slate-400',   text: 'text-slate-400'   },
    { key: 'reviewing',   label: 'Reviewing',    color: 'bg-blue-400',    text: 'text-blue-400'    },
    { key: 'shortlisted', label: 'Shortlisted',  color: 'bg-brand-400',   text: 'text-brand-400'   },
    { key: 'interviewed', label: 'Interviewed',  color: 'bg-purple-400',  text: 'text-purple-400'  },
    { key: 'offered',     label: 'Offered',      color: 'bg-emerald-400', text: 'text-emerald-400' },
  ];

  const statusCounts = PIPELINE_STAGES.reduce((acc, { key }) => {
    acc[key] = allApps.filter(a => a.status === key).length;
    return acc;
  }, {});

  const total          = allApps.length;
  const responded      = allApps.filter(a => a.status !== 'pending').length;
  const responseRate   = total > 0 ? Math.round((responded / total) * 100) : 0;
  const successCount   = statusCounts['offered'] || 0;
  const successRate    = total > 0 ? Math.round((successCount / total) * 100) : 0;
  const maxStageCount  = Math.max(...PIPELINE_STAGES.map(s => statusCounts[s.key]), 1);

  const strength = stats?.summary?.profileStrength || 0;

  // Stat cards — "Jobs Available" replaced with "AI Matches" fed by MatchedJobs
  const statCards = [
    { icon: FileText,    label: 'Applications',  value: stats?.summary?.totalApplications ?? 0, color: 'blue'    },
    { icon: Bookmark,    label: 'Saved Jobs',     value: stats?.summary?.savedJobsCount    ?? 0, color: 'brand'   },
    { icon: XCircle,     label: 'Rejected Applications',         value: rejectedCount,                        color: 'red'     },
    {
      icon: Zap,
      label: 'AI Matches',
      value: aiMatchCount,   // null while MatchedJobs is still fetching
      color: 'purple',
      isAi: true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            Welcome, {user?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-400 mt-1">Here's your job search overview</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ icon: Icon, label, value, color, isAi }) => (
            <div key={label} className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400">{label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  color === 'brand'  ? 'bg-brand-500/20'   :
                  color === 'blue'   ? 'bg-blue-500/20'    :
                  color === 'green'  ? 'bg-emerald-500/20' :
                  color === 'red'    ? 'bg-red-500/20'     :
                                       'bg-purple-500/20'
                }`}>
                  <Icon size={16} className={`${
                    isAi ? 'fill-current ' : ''
                  }${
                    color === 'brand'  ? 'text-brand-400'   :
                    color === 'blue'   ? 'text-blue-400'    :
                    color === 'green'  ? 'text-emerald-400' :
                    color === 'red'    ? 'text-red-400'     :
                                         'text-purple-400'
                  }`} />
                </div>
              </div>

              {/* Show a pulse placeholder until both global stats AND ai count are ready */}
              {(loading || (isAi && aiMatchCount === null)) ? (
                <div className="h-9 w-16 bg-dark-500 rounded-xl animate-pulse" />
              ) : (
                <p className="font-display text-3xl font-bold text-white">{value}</p>
              )}

              {/* Small "AI-powered" label under the AI matches card */}
              {isAi && (
                <p className="text-[10px] text-purple-400/70 mt-1 flex items-center gap-1">
                  <Zap size={8} className="fill-current" /> AI‑powered
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Profile Strength */}
          <div className="lg:col-span-2 card">
            <h2 className="font-semibold text-white mb-4">Profile Strength</h2>
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1f2b4a" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={strength >= 80 ? '#10b981' : strength >= 50 ? '#f0c040' : '#ef4444'}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(strength / 100) * 251.2} 251.2`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-bold text-white">{strength}%</span>
                <span className="text-[10px] text-slate-500">
                  {strength >= 80 ? 'Excellent' : strength >= 50 ? 'Good' : 'Needs work'}
                </span>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5 text-sm max-h-56 overflow-y-auto pr-1">
              {[
                { label: 'Profile Photo',     key: 'profile_picture', pts: 10 },
                { label: 'Headline',          key: 'headline',        pts: 10 },
                { label: 'Bio / Summary',     key: 'bio',             pts: 10 },
                { label: 'Skills (3+)',       key: 'skills',          pts: 10 },
                { label: 'Resume uploaded',   key: 'resume_url',      pts: 15 },
                { label: 'Work experience',   key: 'experience',      pts: 10 },
                { label: 'Education',         key: 'education',       pts: 5  },
                { label: 'Desired job title', key: 'desired_job_title', pts: 5 },
                { label: 'Expected salary',   key: 'expected_salary', pts: 5  },
                { label: 'Experience years',  key: 'experience_years', pts: 5 },
                { label: 'Lives in',          key: 'lives_in',        pts: 3  },
                { label: 'Date of birth',     key: 'date_of_birth',   pts: 2  },
                { label: 'LinkedIn',          key: 'linkedin_url',    pts: 5  },
                { label: 'GitHub',            key: 'github_url',      pts: 3  },
                { label: 'Portfolio',         key: 'portfolio_url',   pts: 2  },
              ].map(({ label, pts }) => {
                const earned = stats?.summary?.strengthItems?.find(i => i.label === label);
                const done   = earned?.done ?? false;
                return (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-500 text-slate-600'
                      }`}>
                        {done ? '✓' : '·'}
                      </span>
                      <span className={`truncate ${done ? 'text-slate-300' : 'text-slate-500'}`}>{label}</span>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${done ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {done ? `+${pts}%` : `${pts}%`}
                    </span>
                  </div>
                );
              })}
            </div>

            <Link to="/candidate/profile" className="btn-primary w-full text-center text-sm mt-4 block">
              Complete Profile
            </Link>
          </div>

          {/* Quick Actions + Recent Apps */}
          <div className="lg:col-span-3 space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/jobs" className="card-hover flex items-center gap-3 group">
                <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center">
                  <Search size={18} className="text-brand-400" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm group-hover:text-brand-400 transition-colors">Find Jobs</p>
                  <p className="text-xs text-slate-500">Browse openings</p>
                </div>
              </Link>
              <Link to="/candidate/profile" className="card-hover flex items-center gap-3 group">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Upload size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm group-hover:text-brand-400 transition-colors">Upload Resume</p>
                  <p className="text-xs text-slate-500">Get matched</p>
                </div>
              </Link>
            </div>

            {/* Recent Applications */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Recent Applications</h2>
                <Link to="/candidate/applications" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
              </div>
              <div className="space-y-3">
                {loading ? (
                  [...Array(3)].map((_, i) => <div key={i} className="h-12 bg-dark-500 rounded-xl animate-pulse" />)
                ) : recentApps.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 text-sm mb-3">No applications yet</p>
                    <Link to="/jobs" className="btn-primary text-sm py-2 px-4">Browse Jobs</Link>
                  </div>
                ) : (
                  recentApps.map((app) => (
                    <div key={app.id} className="flex items-center gap-3 p-3 bg-dark-600 rounded-xl">
                      <div className="w-9 h-9 bg-dark-500 border border-dark-300 rounded-lg flex items-center justify-center text-sm font-bold text-brand-400 flex-shrink-0 overflow-hidden">
                        {app.jobs?.employer_profiles?.company_logo
                          ? <img src={app.jobs.employer_profiles.company_logo} alt="" className="w-full h-full object-cover" />
                          : app.jobs?.employer_profiles?.company_name?.[0] || '?'
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{app.jobs?.title}</p>
                        <p className="text-xs text-slate-500">{app.jobs?.employer_profiles?.company_name} • {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}</p>
                      </div>
                      <span className={`badge text-xs flex-shrink-0 ${statusColors[app.status]}`}>{app.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Application Analytics ── */}
        {!loading && total > 0 && (
          <div className="grid lg:grid-cols-3 gap-4">

            {/* Pipeline funnel */}
            <div className="lg:col-span-2 card">
              <h2 className="font-semibold text-white mb-5">Application Pipeline</h2>
              <div className="space-y-3">
                {PIPELINE_STAGES.map(({ key, label, color, text }) => {
                  const count = statusCounts[key];
                  const pct   = Math.round((count / maxStageCount) * 100);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-20 flex-shrink-0">{label}</span>
                      <div className="flex-1 h-6 bg-dark-600 rounded-lg overflow-hidden">
                        <div
                          className={`h-full ${color} opacity-80 rounded-lg transition-all duration-700`}
                          style={{ width: count === 0 ? '2px' : `${pct}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-6 text-right flex-shrink-0 ${count > 0 ? text : 'text-slate-600'}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                {rejectedCount > 0 && `${rejectedCount} rejected · `}
                {total} total application{total !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Response rate + success rate */}
            <div className="space-y-4">
              <div className="card flex flex-col items-center justify-center text-center py-6">
                <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center mb-3">
                  <MessageSquare size={20} className="text-blue-400" />
                </div>
                <p className="font-display text-3xl font-bold text-white">{responseRate}%</p>
                <p className="text-xs text-slate-400 mt-1">Response Rate</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{responded} of {total} got a reply</p>
              </div>

              <div className="card flex flex-col items-center justify-center text-center py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <p className="font-display text-3xl font-bold text-white">{successRate}%</p>
                <p className="text-xs text-slate-400 mt-1">Offer Rate</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{successCount} offer{successCount !== 1 ? 's' : ''} received</p>
              </div>
            </div>

          </div>
        )}

        {/* MatchedJobs reports its count back up via onMatchCount */}
        <MatchedJobs onMatchCount={setAiMatchCount} />
      </div>
    </DashboardLayout>
  );
}