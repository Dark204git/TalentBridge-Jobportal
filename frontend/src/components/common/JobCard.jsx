import { Link } from 'react-router-dom';
import { MapPin, Clock, DollarSign, Bookmark, BookmarkCheck, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const logoColors = {
  A: 'rgba(212,168,67,0.12)', B: 'rgba(59,130,246,0.12)', C: 'rgba(99,91,255,0.12)',
  D: 'rgba(0,200,150,0.12)',  E: 'rgba(236,72,153,0.12)',  F: 'rgba(239,68,68,0.12)',
  G: 'rgba(66,133,244,0.12)', H: 'rgba(16,185,129,0.12)',  I: 'rgba(245,158,11,0.12)',
  default: 'rgba(255,255,255,0.06)',
};
const logoText = {
  A: '#d4a843', B: '#60a5fa', C: '#8b84ff', D: '#00c896', E: '#f472b6',
  F: '#f87171', G: '#4285f4', H: '#34d399', I: '#fbbf24', default: 'rgba(255,255,255,0.4)',
};

export default function JobCard({ job, saved, onSave, featured = false }) {
  const {
    id, title, location, job_type, salary_min, salary_max,
    is_remote, created_at, skills = [], employer_profiles
  } = job;

  const company = employer_profiles?.company_name || 'Company';
  const logo    = employer_profiles?.company_logo;
  const letter  = company[0]?.toUpperCase() || '?';
  const timeAgo = created_at
    ? formatDistanceToNow(new Date(created_at), { addSuffix: true })
    : '';

  return (
    <div className={`relative group animate-fade-up ${featured ? 'card-featured' : 'card-hover'}`}>

      {featured && (
        <div
          className="absolute top-3.5 right-3.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[.3px] px-2.5 py-1 rounded-[6px]"
          style={{ background: 'rgba(212,168,67,0.14)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}
        >
          <Zap size={10} className="fill-gold text-gold" /> FEATURED
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        {/* Logo */}
        <div
          className="w-10 h-10 rounded-[10px] grid place-items-center text-[15px] font-extrabold flex-shrink-0 overflow-hidden"
          style={{
            background: logoColors[letter] || logoColors.default,
            color: logoText[letter] || logoText.default,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {logo
            ? <img src={logo} alt={company} className="w-full h-full object-cover" />
            : letter
          }
        </div>

        {/* Title & company */}
        <div className="flex-1 min-w-0 pr-16">
          <Link to={`/jobs/${id}`}>
            <h3 className="text-[15px] font-bold text-white leading-tight group-hover:text-gold transition-colors line-clamp-1 tracking-[-0.02em]">
              {title}
            </h3>
          </Link>
          <p className="text-[12px] font-semibold text-gold/80 mt-0.5">{company}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-white/35">
        {location && (
          <span className="flex items-center gap-1"><MapPin size={11} />{location}</span>
        )}
        {is_remote && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-job rounded-full"></span>Remote
          </span>
        )}
        {timeAgo && <span className="flex items-center gap-1"><Clock size={11} />{timeAgo}</span>}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {job_type && (
          <span className="badge-gold capitalize">{job_type}</span>
        )}
        {is_remote && !job_type && (
          <span className="badge-green">Remote</span>
        )}
        {skills.slice(0, 4).map((s) => (
          <span key={s} className="skill-tag">{s}</span>
        ))}
        {skills.length > 4 && (
          <span className="skill-tag text-white/25">+{skills.length - 4}</span>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div>
          {(salary_min || salary_max) ? (
            <span className="text-[14px] font-bold text-white tracking-[-0.02em]">
              {salary_min && `$${(salary_min / 1000).toFixed(0)}k`}
              {salary_min && salary_max && <span className="text-white/30 font-normal"> – </span>}
              {salary_max && `$${(salary_max / 1000).toFixed(0)}k`}
              <span className="text-[11px] font-normal text-white/30 ml-1">/yr</span>
            </span>
          ) : (
            <span className="text-[12px] text-white/25">Salary not listed</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={(e) => { e.preventDefault(); onSave(id); }}
              className="w-[30px] h-[30px] rounded-[8px] grid place-items-center transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: saved ? '#d4a843' : 'rgba(255,255,255,0.3)' }}
              title={saved ? 'Unsave' : 'Save job'}
            >
              {saved
                ? <BookmarkCheck size={13} />
                : <Bookmark size={13} />
              }
            </button>
          )}
          <Link
            to={`/jobs/${id}`}
            className="btn-primary text-[11px] py-[7px] px-4"
          >
            Apply
          </Link>
        </div>
      </div>
    </div>
  );
}
