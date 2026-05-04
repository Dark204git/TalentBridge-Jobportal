import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck, Trash2, Briefcase, UserCheck, Sparkles, Info, Bookmark } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  application_received:       { icon: Briefcase,  color: 'text-brand-400',   bg: 'bg-brand-500/10'   },
  application_status_changed: { icon: UserCheck,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  job_match:                  { icon: Sparkles,   color: 'text-yellow-400',  bg: 'bg-yellow-500/10'  },
  job_saved:                  { icon: Bookmark,   color: 'text-pink-400',    bg: 'bg-pink-500/10'    },
  system:                     { icon: Info,       color: 'text-slate-400',   bg: 'bg-slate-500/10'   },
};

const getConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.system;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markRead, markAllRead, remove, clearAll } = useNotifications();
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (notif) => {
    if (!notif.is_read) markRead(notif.id);
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  return (
    <div className="relative" ref={ref}>

      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative w-[34px] h-[34px] rounded-[10px] grid place-items-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] rounded-[14px] z-[999] shadow-2xl"
          style={{
            background: '#13132a',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] rounded-t-[14px]">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-white/50" />
              <span className="text-[13px] font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                  title="Mark all as read"
                  className="p-1.5 rounded-[7px] text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearAll(); }}
                  title="Clear all"
                  className="p-1.5 rounded-[7px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-[7px] text-white/30 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto" />
                <p className="text-[11px] text-white/20 mt-3">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-14 text-center">
                <Bell size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-[13px] text-white/25 font-medium">No notifications yet</p>
                <p className="text-[11px] text-white/15 mt-1">We'll notify you when something happens</p>
              </div>
            ) : (
              notifications.map((n) => {
                const { icon: Icon, color, bg } = getConfig(n.type);
                return (
                  <div
                    key={n.id}
                    className={`group relative flex items-start gap-3 px-4 py-3 border-b border-white/[0.05] transition-colors cursor-pointer ${
                      !n.is_read ? 'bg-white/[0.035]' : 'hover:bg-white/[0.02]'
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    {/* Unread dot */}
                    {!n.is_read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                    )}

                    {/* Type icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-[9px] ${bg} grid place-items-center mt-0.5 ml-2`}>
                      <Icon size={15} className={color} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12.5px] font-semibold leading-tight truncate ${n.is_read ? 'text-white/45' : 'text-white'}`}>
                        {n.title}
                      </p>
                      <p className={`text-[11.5px] mt-0.5 leading-snug ${n.is_read ? 'text-white/25' : 'text-white/50'}`}>
                        {n.message}
                      </p>
                      <p className="text-[10.5px] text-white/20 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-[6px] text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all mt-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/[0.07] rounded-b-[14px]">
              <p className="text-[11px] text-white/20 text-center">
                Showing latest {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
