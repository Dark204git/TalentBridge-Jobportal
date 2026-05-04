import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, Users, Plus,
  Clock, AlertTriangle, CalendarClock, Inbox,
} from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { analyticsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';

const StatCard = ({ icon: Icon, label, value, sub, color = 'brand', highlight }) => (
  <div className={`card ${highlight ? 'ring-1 ring-brand-500/40' : ''}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className="font-display text-3xl font-bold text-white mt-1">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
        color === 'brand'  ? 'bg-brand-500/20'   :
        color === 'blue'   ? 'bg-blue-500/20'    :
        color === 'green'  ? 'bg-emerald-500/20' :
        color === 'amber'  ? 'bg-amber-500/20'   :
        'bg-purple-500/20'
      }`}>
        <Icon size={20} className={
          color === 'brand'  ? 'text-brand-400'   :
          color === 'blue'   ? 'text-blue-400'    :
          color === 'green'  ? 'text-emerald-400' :
          color === 'amber'  ? 'text-amber-400'   :
          'text-purple-400'
        } />
      </div>
    </div>
  </div>
);

const STATUS_COLORS = {
  pending: 'bg-slate-500', reviewing: 'bg-blue-500', shortlisted: 'bg-brand-500',
  interviewed: 'bg-purple-500', offered: 'bg-emerald-500', rejected: 'bg-red-500', withdrawn: 'bg-slate-600',
};

export default function EmployerDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getEmployerDashboard()
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const summary       = data?.summary || {};
  const urgent        = data?.urgentActions || { stalePending: 0, expiringJobs: [] };
  const statusCounts  = data?.applicationsByStatus || {};
  const totalApps     = summary.totalApplications || 1;
  const hasUrgent     = urgent.stalePending > 0 || urgent.expiringJobs.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1">Welcome back, {user?.full_name?.split(' ')[0]}</p>
          </div>
          <Link to="/employer/jobs/new" className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Post a Job
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Briefcase} label="Total Jobs"         value={summary.totalJobs}         color="brand" />
          <StatCard icon={Briefcase} label="Active Jobs"        value={summary.activeJobs}        color="green" />
          <StatCard icon={Users}     label="Total Applications" value={summary.totalApplications} color="blue"  />
          <StatCard
            icon={Inbox}
            label="New Today"
            value={summary.newToday ?? 0}
            sub="applications received today"
            color="amber"
            highlight={summary.newToday > 0}
          />
        </div>

        {/* Urgent Actions banner */}
        {!loading && hasUrgent && (
          <div className="card border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-400" />
              <h2 className="font-semibold text-amber-300 text-sm">Needs Your Attention</h2>
            </div>
            <div className="space-y-3">
              {urgent.stalePending > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={15} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-300">
                      <span className="text-white font-medium">{urgent.stalePending}</span>{' '}
                      pending application{urgent.stalePending !== 1 ? 's' : ''} waiting over 5 days
                    </span>
                  </div>
                  <Link to="/employer/applications" className="text-xs text-brand-400 hover:text-brand-300 shrink-0">
                    Review →
                  </Link>
                </div>
              )}
              {urgent.expiringJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarClock size={15} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-300">
                      <span className="text-white font-medium">"{job.title}"</span>{' '}
                      closes {(() => {
                        const d = new Date(job.application_deadline);
                        // Deadlines stored as midnight (00:00:00) mean "end of that day"
                        // so push them to 23:59:59 before computing relative time
                        if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
                          d.setHours(23, 59, 59, 999);
                        }
                        const now = new Date();
                        const sameDay = d.toDateString() === now.toDateString();
                        if (sameDay) return 'today';
                        return formatDistanceToNow(d, { addSuffix: true });
                      })()}
                    </span>
                  </div>
                  <Link to={`/employer/jobs/${job.id}/edit`} className="text-xs text-brand-400 hover:text-brand-300 shrink-0">
                    Extend →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Applications by status */}
          <div className="card">
            <h2 className="font-semibold text-white mb-5">Applications by Status</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-dark-500 rounded animate-pulse" />)}
              </div>
            ) : Object.keys(statusCounts).length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No applications yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(statusCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const pct = Math.round((count / totalApps) * 100);
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize text-slate-300">{status}</span>
                          <span className="text-slate-400">{count} <span className="text-slate-600">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-dark-500 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${STATUS_COLORS[status] || 'bg-slate-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Recent jobs */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">Recent Jobs</h2>
              <Link to="/employer/jobs" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-dark-500 rounded animate-pulse" />)}
              </div>
            ) : (data?.recentJobs || []).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm mb-3">No jobs posted yet</p>
                <Link to="/employer/jobs/new" className="btn-primary text-sm py-2 px-4">Post Your First Job</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(data?.recentJobs || []).map(job => (
                  <Link key={job.id} to={`/employer/applications?job=${job.id}`}
                    className="flex items-center justify-between p-3 bg-dark-600 rounded-xl hover:bg-dark-500 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{job.title}</p>
                      <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                        <span>{job.applicationCount} apps</span>
                        <span>{job.views ?? 0} views</span>
                        {job.application_deadline && (
                          <span>closes {format(new Date(job.application_deadline), 'MMM d')}</span>
                        )}
                      </div>
                    </div>
                    <span className={`badge ml-3 shrink-0 ${job.status === 'active' ? 'badge-green' : 'bg-slate-500/20 text-slate-400 badge'}`}>
                      {job.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}