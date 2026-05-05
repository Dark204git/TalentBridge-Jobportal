import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, ExternalLink } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { applicationsAPI } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

const statusColors = {
  pending: 'bg-slate-500/20 text-slate-400', reviewing: 'bg-blue-500/20 text-blue-400',
  shortlisted: 'bg-brand-500/20 text-brand-400', interviewed: 'bg-purple-500/20 text-purple-400',
  offered: 'bg-emerald-500/20 text-emerald-400', rejected: 'bg-red-500/20 text-red-400',
  withdrawn: 'bg-slate-500/20 text-slate-500',
};

const statusLabels = {
  pending: 'Application Submitted', reviewing: 'Under Review', shortlisted: 'Shortlisted! 🌟',
  interviewed: 'Interview Scheduled', offered: 'Job Offer! 🎉', rejected: 'Not Selected', withdrawn: 'Withdrawn',
};

export default function CandidateApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    applicationsAPI.getMine()
      .then(({ data }) => setApplications(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? applications : applications.filter((a) => a.status === filter);
  const counts = applications.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">My Applications</h1>
          <p className="text-slate-400 mt-1">{applications.length} total applications</p>
        </div>

        //Filter Tabs 
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'all' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({applications.length})
          </button>
          {Object.entries(counts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === status ? 'bg-brand-500/10 text-brand-400 border border-brand-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-24" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-5xl mb-4">📭</p>
            <h3 className="font-display text-xl font-bold text-white mb-2">
              {filter === 'all' ? 'No applications yet' : `No ${filter} applications`}
            </h3>
            <p className="text-slate-400 mb-6">Start applying to jobs you love</p>
            <Link to="/jobs" className="btn-primary inline-flex items-center gap-2"><Briefcase size={16} /> Find Jobs</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((app) => (
              <div key={app.id} className="card hover:border-dark-300 transition-colors">
                <div className="flex items-start gap-4">
                  //Company Logo 
                  <div className="w-12 h-12 bg-dark-500 border border-dark-300 rounded-xl flex items-center justify-center text-lg font-bold text-brand-400 flex-shrink-0">
                    {app.jobs?.employer_profiles?.company_logo ? (
                      <img src={app.jobs.employer_profiles.company_logo} alt="" className="w-full h-full object-cover rounded-xl" />
                    ) : app.jobs?.employer_profiles?.company_name?.[0]?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{app.jobs?.title}</h3>
                        <p className="text-sm text-slate-400 mt-0.5">{app.jobs?.employer_profiles?.company_name}</p>
                      </div>
                      <span className={`badge flex-shrink-0 ${statusColors[app.status]}`}>
                        {app.status}
                      </span>
                    </div>

                    //Status Message 
                    <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${statusColors[app.status]}`}>
                      {statusLabels[app.status]}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                      </span>
                      {app.jobs?.location && <span>{app.jobs.location}</span>}
                      {app.jobs?.job_type && <span className="capitalize">{app.jobs.job_type}</span>}
                    </div>
                  </div>

                  <Link
  to={`/jobs/${app.job_id}`}
  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-500 border border-dark-400 text-slate-300 hover:text-brand-400 hover:border-brand-500/40 transition-colors"
>
  <ExternalLink size={13} />
  View Job
</Link>
                </div>

                //Cover Letter Preview 
                {app.cover_letter && (
                  <div className="mt-4 pt-4 border-t border-dark-400">
                    <p className="text-xs text-slate-500 mb-1">Cover Letter</p>
                    <p className="text-xs text-slate-400 line-clamp-2">{app.cover_letter}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
