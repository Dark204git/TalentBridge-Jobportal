import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Eye, Clock, TrendingUp, Star } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { analyticsAPI } from '../../services/api';

/* ── helpers ── */
const FUNNEL_COLORS = ['#64748b', '#3b82f6', '#f0c040', '#8b5cf6', '#10b981'];

const scoreColor = (s) =>
  s >= 80 ? '#10b981' : s >= 60 ? '#f0c040' : s >= 40 ? '#3b82f6' : '#64748b';

/* ── KPI card ── */
function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <Icon size={16} style={{ color: 'var(--gold)' }} />
      </div>
      <p className="text-4xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--slate2)' }}>{sub}</p>}
    </div>
  );
}

/* ── Recharts custom tooltip ── */
function ChartTooltip({ active, payload, label, unit = 'applications' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--drop-bg)',
      border: '1px solid var(--drop-border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 13,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: 'var(--gold)', fontWeight: 600 }}>{payload[0].value} {unit}</p>
    </div>
  );
}

/* ── Section card wrapper ── */
function SectionCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <h2 className="font-semibold mb-1" style={{ fontSize: 15, color: 'var(--text)' }}>{title}</h2>
      {subtitle && <p className="text-xs mb-5" style={{ color: 'var(--slate2)' }}>{subtitle}</p>}
      {!subtitle && <div style={{ height: 20 }} />}
      {children}
    </div>
  );
}

export default function EmployerAnalytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsAPI.getEmployerStats()
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpis           = data?.kpis || {};
  const weeklyTrend    = data?.weeklyTrend || [];
  const funnel         = data?.funnel || [];
  const scoreDist      = data?.scoreDistribution || [];
  const jobPerformance = data?.jobPerformance || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">

        {/* Page title */}
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>Analytics</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Hiring performance over time</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-28" />)}
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Eye}        label="Total Views"       value={kpis.totalViews?.toLocaleString()} sub="across all job posts" />
              <KpiCard icon={Clock}      label="Avg. Time to Hire" value={kpis.avgTimeToHire != null ? `${kpis.avgTimeToHire}d` : null} sub="applied → offered" />
              <KpiCard icon={TrendingUp} label="Offer Rate"        value={kpis.offerRate != null ? `${kpis.offerRate}%` : null} sub="of interviewed candidates" />
              <KpiCard icon={Star}       label="Avg. Match Score"  value={kpis.avgMatchScore != null ? `${kpis.avgMatchScore}%` : null} sub="across all applications" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">

              {/* Weekly trend bar chart */}
              <SectionCard title="Weekly Applications">
                {weeklyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="week"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        axisLine={false} tickLine={false} allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--line)' }} />
                      <Bar dataKey="applications" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-52 flex items-center justify-center text-sm"
                    style={{ color: 'var(--slate2)' }}>No data yet</div>
                )}
              </SectionCard>

              {/* Hiring funnel */}
              <SectionCard title="Hiring Funnel">
                {funnel.some(f => f.count > 0) ? (
                  <div className="space-y-3">
                    {funnel.map((stage, i) => (
                      <div key={stage.stage}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="capitalize font-medium" style={{ color: 'var(--text)' }}>
                            {stage.stage}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {stage.count}{' '}
                            <span style={{ color: 'var(--slate2)' }}>({stage.pct}%)</span>
                          </span>
                        </div>
                        <div className="h-7 rounded-lg overflow-hidden"
                          style={{ background: 'var(--line2)' }}>
                          <div
                            className="h-full rounded-lg transition-all"
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
                  <div className="h-52 flex items-center justify-center text-sm"
                    style={{ color: 'var(--slate2)' }}>No applications yet</div>
                )}
              </SectionCard>
            </div>

            {/* Match score distribution */}
            <SectionCard title="Match Score Distribution" subtitle="How well applicants match your job requirements">
              {scoreDist.some(b => b.count > 0) ? (
                <div className="grid grid-cols-4 gap-3">
                  {scoreDist.map(({ range, count }) => {
                    const score = parseInt(range);
                    const maxCount = Math.max(...scoreDist.map(b => b.count), 1);
                    const barH = Math.max((count / maxCount) * 80, count > 0 ? 8 : 2);
                    return (
                      <div key={range} className="flex flex-col items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{count}</span>
                        <div className="w-full rounded-lg overflow-hidden" style={{ height: 80, background: 'var(--line2)' }}>
                          <div
                            className="w-full rounded-lg transition-all"
                            style={{
                              height: `${barH}px`,
                              marginTop: `${80 - barH}px`,
                              backgroundColor: scoreColor(score + 20),
                            }}
                          />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{range}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-sm"
                  style={{ color: 'var(--slate2)' }}>No scored applications yet</div>
              )}
            </SectionCard>

            {/* Job performance table */}
            <SectionCard title="Job Performance">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line2)' }}>
                      {['Job Title','Views','Apps','CTR','Avg Match','Status'].map((h, i) => (
                        <th key={h}
                          className={`py-2 font-semibold ${i === 0 ? 'text-left pr-4' : 'text-right px-3'} ${i === 5 ? 'pl-3' : ''}`}
                          style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center" style={{ color: 'var(--slate2)' }}>No jobs yet</td>
                      </tr>
                    ) : jobPerformance.map(job => (
                      <tr key={job.id}
                        style={{ borderBottom: '1px solid var(--line)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--line)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="py-3 pr-4 font-semibold" style={{ color: 'var(--text)' }}>{job.title}</td>
                        <td className="py-3 px-3 text-right" style={{ color: 'var(--text-muted)' }}>{job.views || 0}</td>
                        <td className="py-3 px-3 text-right" style={{ color: 'var(--text-muted)' }}>{job.applicationCount}</td>
                        <td className="py-3 px-3 text-right" style={{ color: 'var(--text-muted)' }}>
                          {job.ctr != null ? `${job.ctr}%` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {job.avgMatchScore != null ? (
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                              fontSize: 12, fontWeight: 600, color: '#fff',
                              background: scoreColor(job.avgMatchScore),
                            }}>
                              {job.avgMatchScore}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--slate2)' }}>—</span>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <span className={job.status === 'active' ? 'badge-green badge' : 'badge-gray badge'}>
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}