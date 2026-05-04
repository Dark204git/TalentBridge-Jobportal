import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase, LayoutDashboard, FileText, BarChart3, User,
  Bookmark, LogOut, Menu, X, Plus, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';
import { profilesAPI } from '../../services/api';

const employerLinks = [
  { href: '/employer',              label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/employer/jobs',         label: 'My Jobs',       icon: Briefcase },
  { href: '/employer/applications', label: 'Applications',  icon: FileText },
  { href: '/employer/analytics',    label: 'Analytics',     icon: BarChart3 },
  { href: '/employer/profile',      label: 'Company Profile', icon: User },
];

const candidateLinks = [
  { href: '/candidate',              label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/jobs',                   label: 'Find Jobs',       icon: Briefcase },
  { href: '/candidate/applications', label: 'My Applications', icon: FileText },
  { href: '/candidate/saved',        label: 'Saved Jobs',      icon: Bookmark },
  { href: '/candidate/profile',      label: 'My Profile',      icon: User },
];

function SidebarContent({ onClose }) {
  const { user, logout, isEmployer } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const links = isEmployer ? employerLinks : candidateLinks;
  const [companyLogo, setCompanyLogo] = useState(null);

  useEffect(() => {
    if (isEmployer) {
      profilesAPI.getEmployer()
        .then(({ data }) => setCompanyLogo(data?.company_logo || null))
        .catch(() => {});
    } else {
      profilesAPI.getCandidate()
        .then(({ data }) => setCompanyLogo(data?.profile_picture || null))
        .catch(() => {});
    }
  }, [isEmployer]);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex flex-col h-full px-4 py-5">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 mb-7 group" onClick={onClose}>
        <div className="w-[30px] h-[30px] rounded-[7px] bg-gold grid place-items-center flex-shrink-0">
          <Briefcase size={14} className="text-ink" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold text-white tracking-[-0.3px]">
          Talent<span className="text-gold">Bridge</span>
        </span>
      </Link>

      {/* User card */}
      <div
        className="flex items-center gap-3 mb-6 p-3 rounded-[12px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0 overflow-hidden"
          style={{ background: 'rgba(212,168,67,0.15)', border: '1.5px solid rgba(212,168,67,0.4)' }}
        >
          {companyLogo
            ? <img src={companyLogo} alt="" className="w-full h-full object-cover" />
            : <span className="text-[13px] font-bold text-gold">{user?.full_name?.[0]?.toUpperCase()}</span>
          }
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate leading-tight">{user?.full_name}</p>
          <p className="text-[10px] text-white/35 capitalize mt-0.5">{user?.role}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            onClick={onClose}
            className={pathname === href ? 'sidebar-link-active' : 'sidebar-link'}
          >
            <Icon size={16} strokeWidth={pathname === href ? 2.5 : 2} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {isEmployer && (
          <Link
            to="/employer/jobs/new"
            onClick={onClose}
            className="btn-primary w-full justify-center mb-3 text-xs"
          >
            <Plus size={14} /> Post a Job
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-[13px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 font-medium"
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
  const [companyLogo, setCompanyLogo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isEmployer) {
      profilesAPI.getEmployer()
        .then(({ data }) => setCompanyLogo(data?.company_logo || null))
        .catch(() => {});
    } else {
      profilesAPI.getCandidate()
        .then(({ data }) => setCompanyLogo(data?.profile_picture || null))
        .catch(() => {});
    }
  }, [isEmployer]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ink2)' }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 flex-shrink-0 h-full overflow-y-auto"
        style={{ background: '#07070f', borderRight: '1px solid rgba(255,255,255,0.07)' }}
      >
        <SidebarContent onClose={() => {}} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside
            className="relative flex flex-col w-64 h-full overflow-y-auto z-10"
            style={{ background: '#07070f', borderRight: '1px solid rgba(255,255,255,0.07)' }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-[8px] text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header
          className="flex-shrink-0 h-14 flex items-center justify-between px-5 sm:px-7"
          style={{ background: '#07070f', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-[8px] text-white/40 hover:text-white hover:bg-white/5 transition-colors mr-2"
          >
            <Menu size={18} />
          </button>
          <div className="text-[15px] font-bold text-white tracking-[-0.02em]">
            {title || `Welcome back, ${user?.full_name?.split(' ')[0]} 👋`}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setDropOpen(!dropOpen)}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-[10px] hover:bg-white/5 transition-colors"
              >
                <div
                  className="w-[30px] h-[30px] rounded-full grid place-items-center flex-shrink-0 overflow-hidden"
                  style={{ background: 'rgba(212,168,67,0.15)', border: '1.5px solid rgba(212,168,67,0.4)' }}
                >
                  {companyLogo
                    ? <img src={companyLogo} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[11px] font-bold text-gold">{user?.full_name?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <span className="text-[13px] font-medium text-white/70 hidden sm:block">
                  {user?.full_name?.split(' ')[0]}
                </span>
                <ChevronDown size={13} className="text-white/30 hidden sm:block" />
              </button>
 
              {dropOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} />
                  <div
                    className="absolute right-0 mt-2 w-52 rounded-[12px] py-1.5 z-50"
                    style={{ background: '#13132a', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <div className="px-4 py-2 border-b border-white/[0.07] mb-1">
                      <p className="text-[12px] font-semibold text-white">{user?.full_name}</p>
                      <p className="text-[11px] text-white/35 capitalize">{user?.role}</p>
                    </div>
                    <Link
                      to={isEmployer ? '/employer/profile' : '/candidate/profile'}
                      className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setDropOpen(false)}
                    >
                      <User size={14} /> My Profile
                    </Link>
                    <button
                      onClick={() => { logout(); navigate('/'); setDropOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
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