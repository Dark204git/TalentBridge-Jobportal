import { useState, useEffect } from 'react';
import { Mail, FileText, Zap, Users, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';

function ScoreRing({ score }) {
  const radius = 20;
  const circ   = 2 * Math.PI * radius;
  const fill   = ((score || 0) / 100) * circ;
  const color  = score >= 75 ? '#10b981'
               : score >= 55 ? '#f0c040'
               : score >= 35 ? '#3b82f6'
               :                '#64748b';

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={radius} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold" style={{ color }}>{score ?? '?'}</span>
      </div>
    </div>
  );
}


export default function MatchingCandidates({ jobId, jobTitle, defaultOpen = false }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const [open, setOpen]             = useState(defaultOpen);

  useEffect(() => {
    if (!jobId) return;

  
    setCandidates([]);
    setError(null);

    setOpen(true);
  }, [jobId]);

  // Separate effect for fetching — runs when open becomes true or jobId changes
  useEffect(() => {
    if (!jobId || !open) return;

    setLoading(true);
    setError(null);

    api.get(`/jobs/${jobId}/matching-candidates?limit=15`)
      .then(({ data }) => setCandidates(data.candidates || []))
      .catch(err => {
        const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to load';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [jobId, open]);

  const handleRefresh = () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    api.get(`/jobs/${jobId}/matching-candidates?limit=15`)
      .then(({ data }) => setCandidates(data.candidates || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  if (!jobId) return null;

  return (
    <div className="card">
      //Header 
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <div className="w-7 h-7 bg-purple-500/15 border border-purple-500/25 rounded-lg grid place-items-center flex-shrink-0">
            <Zap size={13} className="text-purple-400 fill-purple-400" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm">AI-Matched Candidates</span>
            {jobTitle && (
              <span className="text-xs text-slate-500 ml-1.5">for {jobTitle}</span>
            )}
          </div>
          {candidates.length > 0 && (
            <span className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded-full font-medium ml-1">
              {candidates.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          //Refresh button 
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-dark-500 transition-colors disabled:opacity-40"
            title="Refresh matches"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-slate-500 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="mt-4">

          //Embedding not ready yet 
          {error?.includes('not generated') && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>Job embedding is still generating — check back in a few seconds or click refresh.</span>
            </div>
          )}

         
          {error && !error.includes('not generated') && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          //Loading skeletons 
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3 p-3 bg-dark-600 rounded-xl">
                  <div className="w-12 h-12 bg-dark-400 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-dark-400 rounded w-1/2" />
                    <div className="h-3 bg-dark-400 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          //Candidate list 
          {!loading && !error && candidates.length > 0 && (
            <div className="space-y-2">
              {candidates.map(c => (
                <div
                  key={c.user_id}
                  className="flex items-center gap-3 p-3 bg-dark-600 rounded-xl hover:bg-dark-500 transition-colors"
                >
                  <ScoreRing score={c.match_score} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {c.user?.full_name || 'Anonymous Candidate'}
                    </p>
                    {c.headline && (
                      <p className="text-xs text-slate-400 truncate">{c.headline}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(c.skills || []).slice(0, 4).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-dark-400 border border-dark-300 text-slate-400 rounded">
                          {s}
                        </span>
                      ))}
                      {(c.skills || []).length > 4 && (
                        <span className="text-[10px] text-slate-600">+{c.skills.length - 4}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.resume_url && (
                      <a
                        href={c.resume_url} target="_blank" rel="noreferrer"
                        className="p-1.5 rounded-lg border border-dark-300 text-slate-500 hover:text-brand-400 hover:border-brand-500/40 transition-colors"
                        title="View resume"
                      >
                        <FileText size={13} />
                      </a>
                    )}
                    {c.user?.email && (
                      <a
                        href={`mailto:${c.user.email}`}
                        className="p-1.5 rounded-lg border border-dark-300 text-slate-500 hover:text-brand-400 hover:border-brand-500/40 transition-colors"
                        title={`Email ${c.user?.full_name}`}
                      >
                        <Mail size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          //Empty state 
          {!loading && !error && candidates.length === 0 && (
            <div className="text-center py-8">
              <Users size={28} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No strong matches found yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Matches appear once candidates upload and parse their resumes.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}