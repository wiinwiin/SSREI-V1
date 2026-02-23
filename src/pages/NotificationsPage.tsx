import React, { useEffect, useState, useCallback } from 'react';
import {
  Bell, CheckCheck, Check, X, Flame, XCircle, Copy,
  Building2, Calendar, Loader2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useRouter } from '../context/RouterContext';
import type { Notification } from '../types';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; badge: string; dot: string }> = {
  'Hot Lead':           { icon: <Flame size={14} />,     badge: 'bg-red-900/40 text-red-300 border-red-700/40',         dot: 'bg-red-500' },
  'Push Failed':        { icon: <XCircle size={14} />,   badge: 'bg-orange-900/30 text-orange-300 border-orange-700/40', dot: 'bg-orange-500' },
  'Duplicate Detected': { icon: <Copy size={14} />,      badge: 'bg-zinc-800 text-zinc-300 border-zinc-600/40',          dot: 'bg-zinc-400' },
  'Lead Matched':       { icon: <Building2 size={14} />, badge: 'bg-cyan-900/30 text-cyan-300 border-cyan-700/40',       dot: 'bg-cyan-500' },
  'Follow-up Due':      { icon: <Calendar size={14} />,  badge: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/40', dot: 'bg-yellow-500' },
  'General':            { icon: <Bell size={14} />,      badge: 'bg-[#1E6FA4]/15 text-[#1E90FF] border-[#1E6FA4]/30',   dot: 'bg-[#1E90FF]' },
};

function getTypeConfig(type?: string) {
  if (!type) return TYPE_CONFIG['General'];
  return TYPE_CONFIG[type] ?? TYPE_CONFIG['General'];
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function NotificationsPage() {
  const { navigate } = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAll(false);
  };

  const dismiss = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayed = filterType === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <Layout
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      action={
        unreadCount > 0 ? (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 border border-white/15 text-white/60 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Mark all read
          </button>
        ) : undefined
      }
    >
      <div className="flex gap-2 mb-5">
        {(['all', 'unread'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors border ${filterType === t ? 'bg-[#1E6FA4]/20 text-[#1E90FF] border-[#1E6FA4]/40' : 'border-white/10 text-white/40 hover:text-white'}`}
          >
            {t === 'unread' && unreadCount > 0 ? `Unread (${unreadCount})` : t === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#0D1F38] border border-white/8 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-[#0D1F38] border border-white/8 rounded-xl p-16 text-center">
          <Bell size={36} className="mx-auto text-white/15 mb-3" />
          <p className="text-white/45 text-sm font-medium">
            {filterType === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-white/25 text-xs mt-1">
            {filterType === 'unread' ? "You're all caught up!" : 'Activity will appear here as your team works in SSREI'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => {
            const cfg = getTypeConfig(n.type);
            return (
              <NotificationRow
                key={n.id}
                notification={n}
                cfg={cfg}
                onMarkRead={() => markRead(n.id)}
                onDismiss={() => dismiss(n.id)}
                onContactClick={() => n.contact_id && navigate('contact-detail', n.contact_id)}
              />
            );
          })}
        </div>
      )}

      {displayed.length > 0 && (
        <p className="text-center text-white/20 text-xs mt-6">
          Showing {displayed.length} of {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </p>
      )}
    </Layout>
  );
}

interface NotificationRowProps {
  notification: Notification;
  cfg: { icon: React.ReactNode; badge: string; dot: string };
  onMarkRead: () => void;
  onDismiss: () => void;
  onContactClick: () => void;
}

function NotificationRow({ notification: n, cfg, onMarkRead, onDismiss, onContactClick }: NotificationRowProps) {
  return (
    <div
      className={`group flex items-start gap-4 p-4 rounded-xl border transition-all duration-150 ${
        n.read
          ? 'bg-[#0A1628]/60 border-white/5 opacity-60 hover:opacity-80'
          : 'bg-[#0D1F38] border-white/8 hover:border-white/15'
      }`}
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${cfg.badge}`}>
        {cfg.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
            {!n.read && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />}
            {n.type ?? 'General'}
          </span>
        </div>
        <p className={`text-sm leading-snug ${n.read ? 'text-white/45' : 'text-white/80'}`}>
          {n.message}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-white/25 text-xs">{timeAgo(n.created_at)}</span>
          {n.contact_id && (
            <button
              onClick={onContactClick}
              className="text-[#1E90FF]/60 hover:text-[#1E90FF] text-xs transition-colors"
            >
              View contact
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!n.read && (
          <button
            onClick={onMarkRead}
            className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-900/20 transition-colors"
            title="Mark as read"
          >
            <Check size={14} />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
