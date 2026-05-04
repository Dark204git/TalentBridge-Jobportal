import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, Menu, X, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { profilesAPI } from '../../services/api';

export default function Navbar() {
  const { user, logout, isEmployer, isCandidate } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [companyLogo, setCompanyLogo] = useState(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Fetch avatar: company logo for employers, profile picture for candidates
  useEffect(() => {
    if (isEmployer) {
      profilesAPI.getEmployer()
        .then(({ data }) => setCompanyLogo(data?.company_logo || null))
        .catch(() => {});
    } else if (isCandidate) {
      profilesAPI.getCandidate()
        .then(({ data }) => setCompanyLogo(data?.profile_picture || null))
        .catch(() => {});
    } else {
      setCompanyLogo(null);
    }
  }, [isEmployer, isCandidate]);

  const handleLogout = () => { logout(); navigate('/'); setDropOpen(false); };

  const navLinks = isEmployer ? [
    { href: '/employer',              label: 'Dashboard' },
    { href: '/employer/jobs',         label: 'My Jobs' },
    { href: '/employer/applications', label: 'Applications' },
    { href: '/employer/analytics',    label: 'Analytics' },
  ] : isCandidate ? [
    { href: '/candidate',             label: 'Dashboard' },
    { href: '/jobs',                  label: 'Find Jobs' },
    { href: '/candidate/applications',label: 'Applications' },
    { href: '/candidate/saved',       label: 'Saved' },
  ] : [
    { href: '/jobs',    label: 'Find Jobs' },
    { href: '/register?role=employer', label: 'For Employers' },
  ];

  const isActive = (href) => pathname === href;

  return (
    <nav
      className="sticky top-0 z-50 h-[58px] flex items-center justify-between px-5 sm:px-7"
      style={{ background: '#07070f', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
        <div className="w-[30px] h-[30px] rounded-[7px] bg-gold grid place-items-center">
          <Briefcase size={14} className="text-ink" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold text-white tracking-[-0.3px]">
          Talent<span className="text-gold">Bridge</span>
        </span>
      </Link>

      {/* Desktop nav links */}
      <div className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            to={href}
            className={`text-[13px] px-3 py-1.5 rounded-[8px] transition-all duration-150 ${
              isActive(href)
                ? 'text-gold bg-gold/10 font-semibold border border-gold/20'
                : 'text-white/50 hover:text-white hover:bg-white/5 font-medium'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="hidden md:flex items-center gap-2.5">
        {user ? (
          <>
            <NotificationBell />
            {isEmployer && (
              <Link to="/employer/jobs/new" className="btn-primary text-xs py-2 px-4">
                + Post a Job
              </Link>
            )}
            <div className="relative">
              <button
                onClick={() => setDropOpen(!dropOpen)}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-[10px] hover:bg-white/5 transition-colors"
              >
                <div className="w-[30px] h-[30px] rounded-full bg-gold/15 border-[1.5px] border-gold/40 grid place-items-center flex-shrink-0 overflow-hidden">
                  {companyLogo
                    ? <img src={companyLogo} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[11px] font-bold text-gold">{user.full_name?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <span className="text-[13px] font-medium text-white/70">{user.full_name?.split(' ')[0]}</span>
                <ChevronDown size={13} className="text-white/30" />
              </button>

              {dropOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} />
                  <div
                    className="absolute right-0 mt-2 w-52 rounded-[12px] py-1.5 z-50 animate-fade-in"
                    style={{ background: '#13132a', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <div className="px-4 py-2 border-b border-white/[0.07] mb-1">
                      <p className="text-[12px] font-semibold text-white">{user.full_name}</p>
                      <p className="text-[11px] text-white/35 capitalize">{user.role}</p>
                    </div>
                    <Link
                      to={isEmployer ? '/employer/profile' : '/candidate/profile'}
                      className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setDropOpen(false)}
                    >
                      <User size={14} /> My Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={14} /> Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="text-[13px] text-white/45 hover:text-white font-medium transition-colors px-2">
              Sign In
            </Link>
            <Link to="/register" className="btn-primary text-xs py-2 px-4">Get Started</Link>
          </>
        )}
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden p-2 rounded-[8px] text-white/40 hover:text-white hover:bg-white/5 transition-colors"
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0 py-3 px-4 z-50 animate-fade-in"
          style={{ background: '#07070f', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex flex-col gap-0.5">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={`text-[13px] px-3 py-2.5 rounded-[8px] font-medium ${
                  isActive(href) ? 'text-gold bg-gold/10' : 'text-white/55 hover:text-white'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-white/[0.07] pt-2 mt-1">
              {user ? (
                <button onClick={handleLogout} className="text-[13px] px-3 py-2.5 text-red-400/80 w-full text-left">
                  Log Out
                </button>
              ) : (
                <Link to="/register" className="btn-primary w-full text-center mt-1 block" onClick={() => setMenuOpen(false)}>
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}