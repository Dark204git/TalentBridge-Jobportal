import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, Users, Clock, XCircle, CalendarClock, AlertTriangle } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { jobsAPI } from '../../services/api';
import { formatDistanceToNow, format, differenceInCalendarDays } from 'date-fns';
import toast from 'react-hot-toast';

// Returns the effective deadline date (midnight deadlines → end of day)
function effectiveDeadline(raw) {
  const d = new Date(raw);
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

// True when deadline is today or within the next 7 days (and not already past)
function isExpiringSoon(raw) {
  if (!raw) return false;
  const d = effectiveDeadline(raw);
  const daysLeft = differenceInCalendarDays(d, new Date());
  return daysLeft >= 0 && daysLeft <= 7;
}

function deadlineLabel(raw) {
  const d = effectiveDeadline(raw);
  const daysLeft = differenceInCalendarDays(d, new Date());
  if (daysLeft < 0)  return `Closed ${format(d, 'MMM d, yyyy')}`;
  if (daysLeft === 0) return 'Closes today';
  if (daysLeft === 1) return 'Closes tomorrow';
  return `Closes ${format(d, 'MMM d, yyyy')}`;
}

// True when the deadline has already passed
function isDeadlinePast(raw) {
  if (!raw) return false;
  return effectiveDeadline(raw) < new Date();
}

export default function EmployerJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const { data } = await jobsAPI.getMyJobs();

      // Auto-close any active job whose deadline has already passed
      const updated = await Promise.all(
        data.map(async (job) => {
          if (job.status === 'active' && isDeadlinePast(job.application_deadline)) {
            try {
              await jobsAPI.deleteJob(job.id);
              return { ...job, status: 'closed' };
            } catch {
              return job; // leave as-is if the call fails
            }
          }
          return job;
        })
      );

      setJobs(updated);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleClose = async (id, title) => {
    if (!confirm(`Close "${title}"? This will hide it from candidates.`)) return;
    try {
      await jobsAPI.deleteJob(id);
      setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: 'closed' } : j));
      toast.success('Job closed');
    } catch {
      toast.error('Failed to close job');
    }
  };

  const handlePermanentDelete = async (id, title) => {
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
    try {
      await jobsAPI.permanentDeleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success('Job permanently deleted');
    } catch {
      toast.error('Failed to delete job');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">My Jobs</h1>
            <p className="text-slate-400 mt-1">{jobs.length} job{jobs.length !== 1 ? 's' : ''} posted</p>
          </div>
          <Link to="/employer/jobs/new" className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Post New Job
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card animate-pulse flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-dark-500 rounded w-48" />
                  <div className="h-4 bg-dark-500 rounded w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-5xl mb-4">📋</p>
            <h3 className="font-display text-xl font-bold text-white mb-2">No jobs yet</h3>
            <p className="text-slate-400 mb-6">Post your first job to start finding candidates</p>
            <Link to="/employer/jobs/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Post a Job
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const expiring   = job.status === 'active' && isExpiringSoon(job.application_deadline);
              const deadlinePast = isDeadlinePast(job.application_deadline);
              return (
                <div
                  key={job.id}
                  className={`card transition-colors ${
                    expiring
                      ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
                      : job.status === 'closed'
                      ? 'opacity-75 hover:border-dark-300'
                      : 'hover:border-dark-300'
                  }`}
                >
                  {/* Expiry alert banner */}
                  {expiring && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-amber-500/20">
                      <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                      <p className="text-xs text-amber-300 font-medium">
                        This job is expiring soon —{' '}
                        <Link to={`/employer/jobs/${job.id}/edit`} className="underline underline-offset-2 hover:text-amber-200">
                          extend the deadline
                        </Link>
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-white">{job.title}</h3>
                        <span className={`badge ${job.status === 'active' ? 'badge-green' : 'bg-slate-500/20 text-slate-400 badge'}`}>
                          {job.status}
                        </span>
                        {job.status === 'closed' && deadlinePast && (
                          <span className="badge bg-red-500/15 text-red-400 border border-red-500/30">
                            Deadline passed
                          </span>
                        )}
                        {job.is_remote && <span className="badge-gold">Remote</span>}
                      </div>

                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Eye size={12} /> {job.views || 0} views</span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {job.applications?.[0]?.count ?? 0} applications
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </span>
                        {job.location && <span className="capitalize">{job.job_type} • {job.location}</span>}

                        {/* Deadline */}
                        {job.application_deadline && (
                          <span className={`flex items-center gap-1 font-medium ${
                            expiring ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            <CalendarClock size={12} />
                            {deadlineLabel(job.application_deadline)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        to={`/employer/applications?job=${job.id}`}
                        className="btn-secondary py-2 px-3 text-sm flex items-center gap-1"
                      >
                        <Users size={14} /> Applications
                      </Link>

                      {job.status === 'active' && (
                        <>
                          <Link
                            to={`/employer/jobs/${job.id}/edit`}
                            className="p-2 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                            title="Edit job"
                          >
                            <Edit size={16} />
                          </Link>
                          <button
                            onClick={() => handleClose(job.id, job.title)}
                            className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Close job"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}

                      {job.status === 'closed' && (
                        <button
                          onClick={() => handlePermanentDelete(job.id, job.title)}
                          className="p-2 rounded-lg text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                          title="Permanently delete job"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}