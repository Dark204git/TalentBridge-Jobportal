import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, Menu, X, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { profilesAPI } from '../../services/api';

function NavDropItem({ to, onClick, children }) {
  return (
    <Link to={to} onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors"
      style={{ color: 'var(--drop-item)' }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--drop-item-hover)'; e.currentTarget.style.background = 'var(--drop-hover-bg)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--drop-item)'; e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, logout, isEmployer, isCandidate } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [companyLogo, setCompanyLogo] = useState(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (isEmployer) {
      profilesAPI.getEmployer().then(({ data }) => setCompanyLogo(data?.company_logo || null)).catch(() => {});
    } else if (isCandidate) {
      profilesAPI.getCandidate().then(({ data }) => setCompanyLogo(data?.profile_picture || null)).catch(() => {});
    } else {
      setCompanyLogo(null);
    }
  }, [isEmployer, isCandidate]);

  const handleLogout = () => { logout(); navigate('/'); setDropOpen(false); setMenuOpen(false); };

  const navLinks = isEmployer ? [
    { href: '/employer',              label: 'Dashboard' },
    { href: '/employer/jobs',         label: 'My Jobs' },
    { href: '/employer/applications', label: 'Applications' },
    { href: '/employer/analytics',    label: 'Analytics' },
  ] : isCandidate ? [
    { href: '/candidate',              label: 'Dashboard' },
    { href: '/jobs',                   label: 'Find Jobs' },
    { href: '/candidate/applications', label: 'Applications' },
    { href: '/candidate/saved',        label: 'Saved' },
  ] : [
    { href: '/jobs',                   label: 'Find Jobs' },
    { href: '/register?role=employer', label: 'For Employers' },
  ];

  const isActive = (href) => pathname === href;

  return (
    <nav className="sticky top-0 z-50 h-[58px] flex items-center justify-between px-5 sm:px-7"
      style={{
        background: 'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
      }}>

      //Logo 
      <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-[30px] h-[30px] rounded-[7px] grid place-items-center"
          style={{ background: 'var(--gold)' }}>
          <Briefcase size={14} style={{ color: '#07070f' }} strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold tracking-[-0.3px]"
          style={{ color: 'var(--topbar-title)' }}>
          Talent<span style={{ color: 'var(--gold)' }}>Bridge</span>
        </span>
      </Link>

      //Desktop nav links 
      <div className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
        {navLinks.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} to={href}
              className="text-[13px] px-3 py-1.5 rounded-[8px] transition-all duration-150"
              style={{
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                background: active ? 'var(--gold4)' : 'transparent',
                border: active ? '1px solid var(--gold-border)' : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--line)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}}>
              {label}
            </Link>
          );
        })}
      </div>

      //Desktop right side 
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
              <button onClick={() => setDropOpen(v => !v)}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-[10px] transition-colors"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--line)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div className="w-[30px] h-[30px] rounded-full grid place-items-center flex-shrink-0 overflow-hidden"
                  style={{ background: 'var(--gold3)', border: '1.5px solid var(--gold-border)' }}>
                  {companyLogo
                    ? <img src={companyLogo} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[11px] font-bold" style={{ color: 'var(--gold)' }}>
                        {user.full_name?.[0]?.toUpperCase()}
                      </span>
                  }
                </div>
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  {user.full_name?.split(' ')[0]}
                </span>
                <ChevronDown size={13} style={{ color: 'var(--slate2)' }} />
              </button>

              {dropOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-[12px] py-1.5 z-50 animate-fade-in"
                    style={{
                      background: 'var(--drop-bg)',
                      border: '1px solid var(--drop-border)',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                    }}>
                    <div className="px-4 py-2 mb-1"
                      style={{ borderBottom: '1px solid var(--drop-divider)' }}>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--drop-name)' }}>
                        {user.full_name}
                      </p>
                      <p className="text-[11px] capitalize" style={{ color: 'var(--drop-role)' }}>
                        {user.role}
                      </p>
                    </div>
                    <NavDropItem to={isEmployer ? '/employer/profile' : '/candidate/profile'} onClick={() => setDropOpen(false)}>
                      <User size={14} /> My Profile
                    </NavDropItem>
                    <NavDropItem to={isEmployer ? '/employer/settings' : '/candidate/settings'} onClick={() => setDropOpen(false)}>
                      <Settings size={14} /> Settings
                    </NavDropItem>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors"
                      style={{ color: 'rgba(248,113,113,0.80)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(248,113,113,0.80)'; e.currentTarget.style.background = 'transparent'; }}>
                      <LogOut size={14} /> Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login"
              className="text-[13px] font-medium transition-colors px-2"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              Sign In
            </Link>
            <Link to="/register" className="btn-primary text-xs py-2 px-4">Get Started</Link>
          </>
        )}
      </div>

      //Mobile hamburger 
      <button onClick={() => setMenuOpen(v => !v)}
        className="md:hidden p-2 rounded-[8px] transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--line)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      //Mobile menu 
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 py-3 px-4 z-50 animate-fade-in"
          style={{
            background: 'var(--topbar-bg)',
            borderBottom: '1px solid var(--topbar-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
          <div className="flex flex-col gap-0.5">
            {navLinks.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link key={href} to={href}
                  className="text-[13px] px-3 py-2.5 rounded-[8px] transition-colors"
                  style={{
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--gold)' : 'var(--text-muted)',
                    background: active ? 'var(--gold4)' : 'transparent',
                  }}
                  onClick={() => setMenuOpen(false)}>
                  {label}
                </Link>
              );
            })}
            <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--topbar-border)' }}>
              {user ? (
                <button onClick={handleLogout}
                  className="text-[13px] px-3 py-2.5 w-full text-left rounded-[8px] transition-colors"
                  style={{ color: 'rgba(248,113,113,0.80)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(248,113,113,0.80)'}>
                  Log Out
                </button>
              ) : (
                <Link to="/register" className="btn-primary w-full text-center mt-1 block"
                  onClick={() => setMenuOpen(false)}>
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