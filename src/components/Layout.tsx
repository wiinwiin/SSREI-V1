import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Bell, Check, CheckCheck, Flame, XCircle, Copy, Building2, Calendar, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from '../context/RouterContext';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { supabase } from '../lib/supabase';
import type { Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const NOTIF_TYPE_ICON: Record<string, React.ReactNode> = {
  'Hot Lead': <Flame size={13} className="text-red-400" />,
  'Push Failed': <XCircle size={13} className="text-orange-400" />,
  'Duplicate Detected': <Copy size={13} className="text-zinc-400" />,
  'Lead Matched': <Building2 size={13} className="text-cyan-400" />,
  'Follow-up Due': <Calendar size={13} className="text-yellow-400" />,
  'General': <Bell size={13} className="text-[#1E90FF]" />,
};

function getNotifIcon(type?: string) {
  if (!type) return NOTIF_TYPE_ICON['General'];
  return NOTIF_TYPE_ICON[type] ?? NOTIF_TYPE_ICON['General'];
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Layout({ children, title, subtitle, action }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const { navigate } = useRouter();
  const [animating, setAnimating] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const unreadCount = useNotificationCount();

  const handleToggle = () => {
    setAnimating(true);
    toggleTheme();
    setTimeout(() => setAnimating(false), 700);
  };

  const openBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) {
      setNotifsLoading(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentNotifs((data ?? []) as Notification[]);
      setNotifsLoading(false);
    }
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', id);
    setRecentNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('read', false);
    setRecentNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBellOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="ssrei-app min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <header
          className="backdrop-blur border-b px-6 lg:px-8 py-4 sticky top-0 z-20"
          style={{ backgroundColor: 'var(--bg-header)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <div className="pl-12 lg:pl-0">
              <h1 className="font-semibold text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {action && <div>{action}</div>}

              <div ref={bellRef} className="relative">
                <button
                  onClick={openBell}
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: bellOpen
                      ? 'rgba(30,111,164,0.2)'
                      : (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'),
                    color: bellOpen
                      ? '#1E90FF'
                      : (theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)'),
                  }}
                  title="Notifications"
                >
                  <Bell size={17} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 top-full mt-2 w-96 bg-[#0D1F38] border border-white/12 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="flex items-center gap-1 text-white/40 hover:text-white text-xs transition-colors"
                          >
                            <CheckCheck size={12} />
                            Mark all read
                          </button>
                        )}
                        <button onClick={() => setBellOpen(false)} className="text-white/30 hover:text-white transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                      {notifsLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="w-5 h-5 border-2 border-[#1E6FA4] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : recentNotifs.length === 0 ? (
                        <div className="flex flex-col items-center py-10 gap-2">
                          <Bell size={24} className="text-white/15" />
                          <p className="text-white/35 text-xs">No notifications yet</p>
                        </div>
                      ) : (
                        recentNotifs.map(n => (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025] ${n.read ? 'opacity-50' : ''}`}
                          >
                            <div className="flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
                              {getNotifIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/75 text-xs leading-snug line-clamp-2">{n.message}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-white/25 text-xs">{timeAgo(n.created_at)}</span>
                                {n.contact_id && (
                                  <button
                                    onClick={() => {
                                      if (n.contact_id) navigate('contact-detail', n.contact_id);
                                      setBellOpen(false);
                                    }}
                                    className="text-[#1E90FF]/55 hover:text-[#1E90FF] text-xs transition-colors"
                                  >
                                    View
                                  </button>
                                )}
                              </div>
                            </div>
                            {!n.read && (
                              <button
                                onClick={() => markRead(n.id)}
                                className="flex-shrink-0 p-1 text-white/20 hover:text-emerald-400 transition-colors"
                                title="Mark as read"
                              >
                                <Check size={12} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-white/8">
                      <button
                        onClick={() => { navigate('notifications'); setBellOpen(false); }}
                        className="w-full text-center text-[#1E90FF] text-xs font-medium hover:text-[#1E90FF]/75 transition-colors py-0.5"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleToggle}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)',
                }}
              >
                {theme === 'dark' ? (
                  <Moon size={17} className={animating ? 'animate-glow-pulse' : ''} style={{ color: animating ? '#3b82f6' : undefined }} />
                ) : (
                  <Sun size={17} className={animating ? 'animate-sun-spin' : ''} />
                )}
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
