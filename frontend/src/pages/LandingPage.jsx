import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowRight, Zap, Shield, BarChart3, Bell } from 'lucide-react';
import Navbar from '../components/common/Navbar';

const STATS = [
  { value: '50k+', label: 'Active Jobs' },
  { value: '8.5k+', label: 'Companies' },
  { value: '94%',  label: 'Match Rate' },
  { value: '48h',  label: 'Avg. Response' },
];

const CATEGORIES = [
  { icon: '💻', label: 'Technology',   count: '18,400' },
  { icon: '🎨', label: 'Design',       count: '4,200' },
  { icon: '📊', label: 'Finance',      count: '5,100' },
  { icon: '📈', label: 'Marketing',    count: '3,800' },
  { icon: '🏥', label: 'Healthcare',   count: '6,700' },
  { icon: '⚖️', label: 'Legal',        count: '2,100' },
  { icon: '🎓', label: 'Education',    count: '4,500' },
  { icon: '🏗️', label: 'Engineering', count: '8,300' },
];

const FEATURES = [
  { icon: Zap,      title: 'AI Job Matching',   desc: 'Smart algorithm matches your skills to the right opportunities instantly.' },
  { icon: Shield,   title: 'Verified Companies', desc: 'Every employer is verified. No spam, no ghost jobs.' },
  { icon: BarChart3,title: 'Real-time Analytics',desc: 'Track applications and see how employers engage with your profile.' },
  { icon: Bell,     title: 'Instant Alerts',     desc: 'Get notified the moment a matching job is posted.' },
];

export default function LandingPage() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (search)   p.set('search', search);
    if (location) p.set('location', location);
    navigate(`/jobs?${p}`);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink2)' }}>
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pt-20 pb-24 sm:px-8">
        {/* Orbs */}
        <div className="pointer-events-none absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-100"
          style={{ background: 'radial-gradient(circle, rgba(212,168,67,0.07) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="pointer-events-none absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,91,255,0.05) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-[.5px] uppercase mb-7"
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)', color: '#d4a843' }}
          >
            <span className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse-dot"></span>
            AI-Powered Job Matching
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-[1.05] tracking-[-0.04em] mb-5">
            Find Your<br />
            <span className="text-gradient">Dream Career</span>
          </h1>

          <p className="text-[16px] text-white/45 leading-relaxed max-w-xl mx-auto mb-10">
            Connect with top employers using intelligent skill matching.
            Upload your resume once — let AI do the rest.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-10">
            <div
              className="flex flex-col sm:flex-row gap-0 p-2 rounded-[14px]"
              style={{ background: '#13132a', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <div className="flex items-center gap-2.5 flex-1 px-3 py-3 sm:py-0">
                <Search size={15} className="text-white/25 flex-shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Job title, skills, company…"
                  className="flex-1 bg-transparent text-white placeholder-white/25 text-[13px] outline-none font-medium"
                />
              </div>

              {/* Divider — horizontal on mobile, vertical on desktop */}
              <div
                className="block sm:hidden mx-3"
                style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }}
              />
              <div
                className="hidden sm:block w-px my-2"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              />

              <div className="flex items-center gap-2.5 px-3 py-3 sm:py-0 sm:w-44">
                <MapPin size={15} className="text-white/25 flex-shrink-0" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location or Remote"
                  className="flex-1 bg-transparent text-white placeholder-white/25 text-[13px] outline-none font-medium"
                />
              </div>

              <div className="p-1 pt-0 sm:p-0">
                <button type="submit" className="btn-primary rounded-[10px] text-[13px] flex-shrink-0 w-full sm:w-auto">
                  Search Jobs <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </form>

          {/* Quick searches */}
          <div className="flex flex-wrap justify-center gap-2 mb-12 text-[12px]">
            <span className="text-white/25">Trending:</span>
            {['React Developer', 'Product Manager', 'Data Scientist', 'UX Designer'].map((q) => (
              <button
                key={q}
                onClick={() => navigate(`/jobs?search=${encodeURIComponent(q)}`)}
                className="text-white/45 hover:text-gold transition-colors underline underline-offset-2"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-[26px] font-extrabold text-white tracking-[-0.04em]">{value}</div>
                <div className="text-[11px] text-white/35 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="px-5 sm:px-8 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="section-heading mb-2">Browse by Category</h2>
            <p className="text-[14px] text-white/35">Explore opportunities across every industry</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map(({ icon, label, count }) => (
              <button
                key={label}
                onClick={() => navigate(`/jobs?category=${label.toLowerCase()}`)}
                className="card-hover text-left p-4 group"
              >
                <div className="text-2xl mb-3">{icon}</div>
                <p className="text-[14px] font-bold text-white group-hover:text-gold transition-colors leading-tight">{label}</p>
                <p className="text-[11px] text-white/30 mt-1">{count} jobs</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-5 sm:px-8 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#07070f' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-heading mb-2">Why TalentBridge?</h2>
            <p className="text-[14px] text-white/35">Built for modern hiring, powered by AI</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-5">
                <div
                  className="w-9 h-9 rounded-[10px] grid place-items-center mb-4"
                  style={{ background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.2)' }}
                >
                  <Icon size={17} className="text-gold" />
                </div>
                <h3 className="text-[14px] font-bold text-white mb-1.5">{title}</h3>
                <p className="text-[12px] text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 sm:px-8 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4">
          <div
            className="card p-8"
            style={{ border: '1px solid rgba(212,168,67,0.25)', background: 'linear-gradient(135deg, rgba(212,168,67,0.07), transparent)' }}
          >
            <div className="text-3xl mb-4">🎯</div>
            <h3 className="section-heading text-[20px] mb-2">Find Your Dream Job</h3>
            <p className="text-[13px] text-white/40 leading-relaxed mb-6">
              Upload your resume and let AI match you with the right opportunities. Get notified instantly.
            </p>
            <Link to="/register?role=candidate" className="btn-primary inline-flex">
              Start Job Search <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card p-8">
            <div className="text-3xl mb-4">🏢</div>
            <h3 className="section-heading text-[20px] mb-2">Hire Top Talent</h3>
            <p className="text-[13px] text-white/40 leading-relaxed mb-6">
              Post jobs and reach thousands of verified candidates. Our AI finds the best match, faster.
            </p>
            <Link to="/register?role=employer" className="btn-secondary inline-flex">
              Post a Job <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-5 sm:px-8 py-8"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#07070f' }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-gold grid place-items-center">
              <span className="text-[10px] font-black text-ink">TB</span>
            </div>
            <span className="text-[14px] font-bold text-white tracking-[-0.02em]">TalentBridge</span>
          </div>
          <p className="text-[12px] text-white/25">© 2025 TalentBridge. All rights reserved.</p>
          <div className="flex gap-5 text-[12px] text-white/35">
            {['Privacy', 'Terms', 'Contact'].map((l) => (
              <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}