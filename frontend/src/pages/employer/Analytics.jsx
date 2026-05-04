import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import { Eye, Clock, TrendingUp, Star } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { analyticsAPI } from '../../services/api';

// ── KPI card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub }) => (
  <div className="card">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm text-slate-400">{label}</p>
      <Icon size={16} className="text-brand-400" />
    </div>
    <p className="font-display text-4xl font-bold text-white">{value ?? '—'}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

// ── Tooltip shared style ──────────────────────────────────────────────────────
const TooltipBox = ({ active, payload, label, unit = 'applications' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-600 border border-dark-400 rounded-lg px-3 py-2 text-sm">
      <p className="text-slate-300 mb-1">{label}</p>
      <p className="text-brand-400 font-semibold">{payload[0].value} {unit}</p>
    </div>
  );
};

// ── Score badge colour ────────────────────────────────────────────────────────
const scoreBg  = (s) => s >= 80 ? 'bg-emerald-500' : s >= 60 ? 'bg-brand-500' : s >= 40 ? 'bg-blue-500' : 'bg-slate-500';
const FUNNEL_COLORS = ['#64748b', '#3b82f6', '#f0c040', '#8b5cf6', '#10b981'];

export default function EmployerAnalytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getEmployerStats()
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpis             = data?.kpis || {};
  const weeklyTrend      = data?.weeklyTrend || [];
  const funnel           = data?.funnel || [];
  const scoreDist        = data?.scoreDistribution || [];
  const jobPerformance   = data?.jobPerformance || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Hiring performance over time</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-28" />)}
          </div>
        ) : (
          <>
            {/* KPI cards — performance metrics, not daily counts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Eye}       label="Total Views"        value={kpis.totalViews?.toLocaleString()}  sub="across all job posts" />
              <KpiCard icon={Clock}     label="Avg. Time to Hire"  value={kpis.avgTimeToHire != null ? `${kpis.avgTimeToHire}d` : null} sub="applied → offered" />
              <KpiCard icon={TrendingUp} label="Offer Rate"        value={kpis.offerRate != null ? `${kpis.offerRate}%` : null} sub="of interviewed candidates" />
              <KpiCard icon={Star}      label="Avg. Match Score"   value={kpis.avgMatchScore != null ? `${kpis.avgMatchScore}%` : null} sub="across all applications" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Weekly trend — real date labels */}
              <div className="card">
                <h2 className="font-semibold text-white mb-5">Weekly Applications</h2>
                {weeklyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<TooltipBox />} />
                      <Bar dataKey="applications" fill="#f0c040" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-52 flex items-center justify-center text-slate-500 text-sm">No data yet</div>
                )}
              </div>

              {/* Application funnel */}
              <div className="card">
                <h2 className="font-semibold text-white mb-5">Hiring Funnel</h2>
                {funnel.some(f => f.count > 0) ? (
                  <div className="space-y-2">
                    {funnel.map((stage, i) => (
                      <div key={stage.stage}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize text-slate-300">{stage.stage}</span>
                          <span className="text-slate-400">{stage.count} <span className="text-slate-600">({stage.pct}%)</span></span>
                        </div>
                        <div className="h-7 bg-dark-500 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg transition-all flex items-center px-2"
                            style={{
                              width: `${Math.max(stage.pct, 2)}%`,
                              backgroundColor: FUNNEL_COLORS[i],
                              opacity: 0.85,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-52 flex items-center justify-center text-slate-500 text-sm">No applications yet</div>
                )}
              </div>
            </div>

            {/* Match score distribution */}
            <div className="card">
              <h2 className="font-semibold text-white mb-5">Match Score Distribution</h2>
              <p className="text-xs text-slate-500 mb-4">How well applicants match your job requirements</p>
              {scoreDist.some(b => b.count > 0) ? (
                <div className="grid grid-cols-4 gap-3">
                  {scoreDist.map(({ range, count }) => {
                    const score = parseInt(range);
                    const maxCount = Math.max(...scoreDist.map(b => b.count), 1);
                    const barH = Math.max((count / maxCount) * 80, count > 0 ? 8 : 2);
                    return (
                      <div key={range} className="flex flex-col items-center gap-2">
                        <span className="text-sm font-medium text-white">{count}</span>
                        <div className="w-full bg-dark-500 rounded-lg overflow-hidden" style={{ height: 80 }}>
                          <div
                            className={`w-full rounded-lg transition-all ${scoreBg(score + 20)}`}
                            style={{ height: `${barH}px`, marginTop: `${80 - barH}px` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{range}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-slate-500 text-sm">No scored applications yet</div>
              )}
            </div>

            {/* Job performance — all jobs with avg match score */}
            <div className="card">
              <h2 className="font-semibold text-white mb-5">Job Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-400">
                      <th className="text-left text-slate-500 font-medium py-2 pr-4">Job Title</th>
                      <th className="text-right text-slate-500 font-medium py-2 px-3">Views</th>
                      <th className="text-right text-slate-500 font-medium py-2 px-3">Apps</th>
                      <th className="text-right text-slate-500 font-medium py-2 px-3">CTR</th>
                      <th className="text-right text-slate-500 font-medium py-2 px-3">Avg Match</th>
                      <th className="text-right text-slate-500 font-medium py-2 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobPerformance.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-500">No jobs yet</td></tr>
                    ) : jobPerformance.map(job => (
                      <tr key={job.id} className="border-b border-dark-400/50 hover:bg-dark-600/50 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium">{job.title}</td>
                        <td className="py-3 px-3 text-right text-slate-400">{job.views || 0}</td>
                        <td className="py-3 px-3 text-right text-slate-400">{job.applicationCount}</td>
                        <td className="py-3 px-3 text-right text-slate-400">
                          {job.ctr != null ? `${job.ctr}%` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {job.avgMatchScore != null ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${scoreBg(job.avgMatchScore)}`}>
                              {job.avgMatchScore}%
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <span className={`badge ${job.status === 'active' ? 'badge-green' : 'bg-slate-500/20 text-slate-400 badge'}`}>
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}