import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, MapPin, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// Color thresholds for match score badge
function scoreStyle(score) {
  if (score >= 75) return { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400' };
  if (score >= 55) return { bg: 'bg-brand-500/15 border-brand-500/30',   text: 'text-brand-400'   };
  if (score >= 35) return { bg: 'bg-blue-500/15 border-blue-500/30',     text: 'text-blue-400'    };
  return                  { bg: 'bg-slate-500/15 border-slate-500/30',   text: 'text-slate-400'   };
}

function ScoreBadge({ score }) {
  if (score == null) return null;
  const { bg, text } = scoreStyle(score);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${bg} ${text}`}>
      <Zap size={10} className="fill-current" />
      {score}% match
    </span>
  );
}

// SVG donut chart showing match percentage
function MatchDonut({ score }) {

  const size   = 48;
  const stroke = 4.5;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const pct    = score ?? 0;
  const filled = (pct / 100) * circ;

  const color =
    score == null ? '#334155' :   // slate — no score yet
    score >= 75   ? '#34d399' :   // emerald
    score >= 55   ? '#818cf8' :   // indigo
    score >= 35   ? '#60a5fa' :   // blue
                    '#64748b';    // slate-low

  const label = score == null ? '?' : `${score}%`;

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0" title={score == null ? 'Upload resume for a match score' : `${score}% match`}>
    
      <div className="relative" style={{ width: size, height: size }}>
       
        <svg
          width={size} height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
        >
          
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          
          <circle cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.7s ease' }}
          />
        </svg>
    
        <svg
          width={size} height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <text
            x={size / 2} y={size / 2}
            dominantBaseline="middle"
            textAnchor="middle"
            style={{ fontSize: score == null ? '13px' : '10px', fontWeight: 700, fill: color }}
          >
            {label}
          </text>
        </svg>
      </div>
      <span className="text-[9px] text-slate-500 leading-none">
        {score == null ? 'no score' : 'match'}
      </span>
    </div>
  );
}

const DISPLAY_MIN_SCORE = 40; // hide jobs below this match % from the UI

export default function MatchedJobs({ onMatchCount } = {}) {
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [reEmbedding, setRe]    = useState(false);
  const [hasEmbedding, setHasE] = useState(true);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/matching/jobs-for-me?limit=15');
     
      const matched = (data.jobs || []).filter(j => j.match_score >= DISPLAY_MIN_SCORE);
      setJobs(matched);
      setHasE(matched.length > 0 || true);
      onMatchCount?.(matched.length);
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('embedding')) setHasE(false);
      onMatchCount?.(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatches(); }, []);

  const handleReEmbed = async () => {
    setRe(true);
    try {
      await api.post('/matching/re-embed-me');
      toast.success('Profile re-indexed! Refreshing matches…');
      await fetchMatches();
    } catch {
      toast.error('Re-index failed — make sure your resume is uploaded');
    } finally {
      setRe(false);
    }
  };

  return (
    <div className="card">
      //Header 
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-500/15 border border-brand-500/30 rounded-lg grid place-items-center">
            <Zap size={14} className="text-brand-400 fill-brand-400" />
          </div>
          <h2 className="font-semibold text-white">AI Job Matches</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReEmbed}
            disabled={reEmbedding}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={reEmbedding ? 'animate-spin' : ''} />
            {reEmbedding ? 'Re-indexing…' : 'Refresh'}
          </button>
          <Link to="/jobs" className="text-xs text-brand-400 hover:text-brand-300">
            Browse all →
          </Link>
        </div>
      </div>

      //No embedding state 
      {!hasEmbedding && !loading && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Upload your resume to get matches</p>
            <p className="text-xs text-slate-400 mt-1">
              AI matching requires your resume. Go to{' '}
              <Link to="/candidate/profile" className="text-brand-400 underline">My Profile</Link>
              {' '}to upload it.
            </p>
          </div>
        </div>
      )}

      //Loading skeletons 
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3 p-3 bg-dark-600 rounded-xl">
              <div className="w-10 h-10 bg-dark-400 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-dark-400 rounded w-3/4" />
                <div className="h-3 bg-dark-400 rounded w-1/2" />
                <div className="h-3 bg-dark-400 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      //Job list 
      {!loading && jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="flex items-center gap-3 p-3 bg-dark-600 hover:bg-dark-500 rounded-xl transition-colors group"
            >
              //Company logo 
              <div className="w-10 h-10 bg-dark-400 border border-dark-300 rounded-xl grid place-items-center text-sm font-bold text-brand-400 flex-shrink-0">
                {job.employer_profiles?.company_logo
                  ? <img src={job.employer_profiles.company_logo} alt="" className="w-full h-full object-cover rounded-xl" />
                  : job.employer_profiles?.company_name?.[0]?.toUpperCase() || '?'
                }
              </div>

              //Info 
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
                  {job.title}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                  {job.employer_profiles?.company_name && (
                    <span>{job.employer_profiles.company_name}</span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={10} /> {job.location}
                    </span>
                  )}
                  {(job.salary_min || job.salary_max) && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={10} />
                      {job.salary_min && `$${(job.salary_min / 1000).toFixed(0)}k`}
                      {job.salary_min && job.salary_max && '–'}
                      {job.salary_max && `$${(job.salary_max / 1000).toFixed(0)}k`}
                    </span>
                  )}
                </div>
              </div>

              //Match donut chart 
              <MatchDonut score={job.match_score} />
            </Link>
          ))}
        </div>
      )}

      //Empty state 
      {!loading && jobs.length === 0 && hasEmbedding && (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">🎯</p>
          <p className="text-sm text-slate-400">No matches above 30% yet.</p>
          <p className="text-xs text-slate-500 mt-1">Jobs you've applied to are hidden here. Complete your profile and upload a resume to improve your match scores.</p>
        </div>
      )}
    </div>
  );
}