import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase, LayoutDashboard, FileText, BarChart3, User,
  Bookmark, LogOut, Menu, X, Plus, ChevronDown, Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';
import { profilesAPI } from '../../services/api';

const employerLinks = [
  { href: '/employer',              label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/employer/jobs',         label: 'My Jobs',         icon: Briefcase },
  { href: '/employer/applications', label: 'Applications',    icon: FileText },
  { href: '/employer/analytics',    label: 'Analytics',       icon: BarChart3 },
  { href: '/employer/profile',      label: 'Company Profile', icon: User },
  { href: '/employer/settings',     label: 'Settings',        icon: Settings },
];

const candidateLinks = [
  { href: '/candidate',              label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/jobs',                   label: 'Find Jobs',       icon: Briefcase },
  { href: '/candidate/applications', label: 'My Applications', icon: FileText },
  { href: '/candidate/saved',        label: 'Saved Jobs',      icon: Bookmark },
  { href: '/candidate/profile',      label: 'My Profile',      icon: User },
  { href: '/candidate/settings',     label: 'Settings',        icon: Settings },
];

function useLogo(isEmployer) {
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    const fn = isEmployer ? profilesAPI.getEmployer : profilesAPI.getCandidate;
    const key = isEmployer ? 'company_logo' : 'profile_picture';
    fn().then(({ data }) => setLogo(data?.[key] || null)).catch(() => {});
  }, [isEmployer]);
  return logo;
}

function SidebarContent({ onClose }) {
  const { user, isEmployer } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logo = useLogo(isEmployer);
  const links = isEmployer ? employerLinks : candidateLinks;

  return (
    <div className="flex flex-col h-full px-4 py-5"
      style={{ background: 'var(--sidebar-bg)' }}>

      {/* Logo */}
      <Link to="/" onClick={onClose}
        className="flex items-center gap-2.5 mb-7">
        <div className="w-[30px] h-[30px] rounded-[7px] grid place-items-center flex-shrink-0"
          style={{ background: 'var(--gold)' }}>
          <Briefcase size={14} style={{ color: '#07070f' }} strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold tracking-[-0.3px]"
          style={{ color: '#ffffff' }}>
          Talent<span style={{ color: 'var(--gold)' }}>Bridge</span>
        </span>
      </Link>

      {/* User card */}
      <div className="flex items-center gap-3 mb-6 p-3 rounded-[12px]"
        style={{
          background: 'var(--sidebar-user-bg)',
          border: '1px solid var(--sidebar-user-border)',
        }}>
        <div className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0 overflow-hidden"
          style={{
            background: 'var(--gold3)',
            border: '1.5px solid var(--gold-border)',
          }}>
          {logo
            ? <img src={logo} alt="" className="w-full h-full object-cover" />
            : <span className="text-[13px] font-bold" style={{ color: 'var(--gold)' }}>
                {user?.full_name?.[0]?.toUpperCase()}
              </span>
          }
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate leading-tight"
            style={{ color: 'var(--sidebar-name)' }}>{user?.full_name}</p>
          <p className="text-[10px] capitalize mt-0.5"
            style={{ color: 'var(--sidebar-role)' }}>{user?.role}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} to={href} onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-150"
              style={{
                color: active ? 'var(--gold)' : 'var(--sidebar-text)',
                background: active ? 'var(--gold4)' : 'transparent',
                border: active ? '1px solid var(--gold-border)' : '1px solid transparent',
                fontWeight: active ? 600 : 500,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--sidebar-text-hover)'; e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'transparent'; }}}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="pt-4 mt-4"
        style={{ borderTop: '1px solid var(--sidebar-divider)' }}>
        {isEmployer && (
          <Link to="/employer/jobs/new" onClick={onClose}
            className="btn-primary w-full justify-center mb-3 text-xs">
            <Plus size={14} /> Post a Job
          </Link>
        )}
        <button
          onClick={() => { useAuth().logout?.(); navigate('/'); }}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-150"
          style={{ color: 'rgba(248,113,113,0.7)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(248,113,113,0.7)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={15} /> Log Out
        </button>
      </div>
    </div>
  );
}

// Fix: self-contained logout in SidebarContent
function SidebarContentWithAuth({ onClose }) {
  const { user, logout, isEmployer } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logo = useLogo(isEmployer);
  const links = isEmployer ? employerLinks : candidateLinks;

  return (
    <div className="flex flex-col h-full px-4 py-5">

      {/* Logo */}
      <Link to="/" onClick={onClose} className="flex items-center gap-2.5 mb-7">
        <div className="w-[30px] h-[30px] rounded-[7px] grid place-items-center flex-shrink-0"
          style={{ background: 'var(--gold)' }}>
          <Briefcase size={14} style={{ color: '#07070f' }} strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold tracking-[-0.3px]" style={{ color: '#ffffff' }}>
          Talent<span style={{ color: 'var(--gold)' }}>Bridge</span>
        </span>
      </Link>

      {/* User card */}
      <div className="flex items-center gap-3 mb-6 p-3 rounded-[12px]"
        style={{ background: 'var(--sidebar-user-bg)', border: '1px solid var(--sidebar-user-border)' }}>
        <div className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0 overflow-hidden"
          style={{ background: 'var(--gold3)', border: '1.5px solid var(--gold-border)' }}>
          {logo
            ? <img src={logo} alt="" className="w-full h-full object-cover" />
            : <span className="text-[13px] font-bold" style={{ color: 'var(--gold)' }}>
                {user?.full_name?.[0]?.toUpperCase()}
              </span>
          }
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--sidebar-name)' }}>{user?.full_name}</p>
          <p className="text-[10px] capitalize mt-0.5" style={{ color: 'var(--sidebar-role)' }}>{user?.role}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} to={href} onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm transition-all duration-150"
              style={{
                color: active ? 'var(--gold)' : 'var(--sidebar-text)',
                background: active ? 'var(--gold4)' : 'transparent',
                border: active ? '1px solid var(--gold-border)' : '1px solid transparent',
                fontWeight: active ? 600 : 500,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--sidebar-text-hover)'; e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'transparent'; }}}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="pt-4 mt-4" style={{ borderTop: '1px solid var(--sidebar-divider)' }}>
        {isEmployer && (
          <Link to="/employer/jobs/new" onClick={onClose}
            className="btn-primary w-full justify-center mb-3 text-xs">
            <Plus size={14} /> Post a Job
          </Link>
        )}
        <button onClick={() => { logout(); navigate('/'); }}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-150"
          style={{ color: 'rgba(248,113,113,0.7)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(248,113,113,0.7)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={15} /> Log Out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children, title }) {
  const { user, logout, isEmployer } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const logo = useLogo(isEmployer);
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ink2)' }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 h-full overflow-y-auto"
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}>
        <SidebarContentWithAuth onClose={() => {}} />
      </aside>

      {/* ── Mobile Sidebar ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 h-full overflow-y-auto z-10"
            style={{
              background: 'var(--sidebar-bg)',
              borderRight: '1px solid var(--sidebar-border)',
            }}>
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-[8px] transition-colors"
              style={{ color: 'rgba(255,255,255,0.40)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; e.currentTarget.style.background = 'transparent'; }}>
              <X size={16} />
            </button>
            <SidebarContentWithAuth onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main Column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 h-14 flex items-center justify-between px-5 sm:px-7"
          style={{
            background: 'var(--topbar-bg)',
            borderBottom: '1px solid var(--topbar-border)',
          }}>

          {/* Mobile menu button */}
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-[8px] transition-colors mr-2"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--line)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
            <Menu size={18} />
          </button>

          {/* Page title */}
          <div className="text-[15px] font-bold tracking-[-0.02em]"
            style={{ color: 'var(--topbar-title)' }}>
            {title || `Welcome back, ${user?.full_name?.split(' ')[0]} 👋`}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* Avatar dropdown */}
            <div className="relative">
              <button onClick={() => setDropOpen(v => !v)}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-[10px] transition-colors"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--line)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div className="w-[30px] h-[30px] rounded-full grid place-items-center flex-shrink-0 overflow-hidden"
                  style={{ background: 'var(--gold3)', border: '1.5px solid var(--gold-border)' }}>
                  {logo
                    ? <img src={logo} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[11px] font-bold" style={{ color: 'var(--gold)' }}>
                        {user?.full_name?.[0]?.toUpperCase()}
                      </span>
                  }
                </div>
                <span className="text-[13px] font-medium hidden sm:block"
                  style={{ color: 'var(--text-muted)' }}>
                  {user?.full_name?.split(' ')[0]}
                </span>
                <ChevronDown size={13} className="hidden sm:block"
                  style={{ color: 'var(--slate2)' }} />
              </button>

              {dropOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-[12px] py-1.5 z-50"
                    style={{
                      background: 'var(--drop-bg)',
                      border: '1px solid var(--drop-border)',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                    }}>
                    {/* User info */}
                    <div className="px-4 py-2 mb-1"
                      style={{ borderBottom: '1px solid var(--drop-divider)' }}>
                      <p className="text-[12px] font-semibold"
                        style={{ color: 'var(--drop-name)' }}>{user?.full_name}</p>
                      <p className="text-[11px] capitalize"
                        style={{ color: 'var(--drop-role)' }}>{user?.role}</p>
                    </div>
                    {/* Profile */}
                    <DropItem
                      to={isEmployer ? '/employer/profile' : '/candidate/profile'}
                      onClick={() => setDropOpen(false)}>
                      <User size={14} /> My Profile
                    </DropItem>
                    {/* Settings */}
                    <DropItem
                      to={isEmployer ? '/employer/settings' : '/candidate/settings'}
                      onClick={() => setDropOpen(false)}>
                      <Settings size={14} /> Settings
                    </DropItem>
                    {/* Logout */}
                    <button
                      onClick={() => { logout(); navigate('/'); setDropOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors"
                      style={{ color: 'rgba(248,113,113,0.8)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(248,113,113,0.8)'; e.currentTarget.style.background = 'transparent'; }}>
                      <LogOut size={14} /> Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function DropItem({ to, onClick, children }) {
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