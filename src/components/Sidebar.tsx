import React, { useState } from 'react';
import {
  LayoutDashboard, Upload, Users, GitBranch,
  UserCheck, Activity, Bell, Settings, Menu, X, LogOut, Home,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import type { Page } from '../types';
import { useNotificationCount } from '../hooks/useNotificationCount';

interface NavItem {
  label: string;
  page: Page;
  icon: React.ReactNode;
  requiredPermission?: 'canViewSettings' | 'canViewBuyers' | 'canViewActivityLog' | 'canImportLeads';
}

const navItems: NavItem[] = [
  { label: 'Dashboard', page: 'dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Lead Import', page: 'lead-import', icon: <Upload size={18} />, requiredPermission: 'canImportLeads' },
  { label: 'Contacts', page: 'contacts', icon: <Users size={18} /> },
  { label: 'Opportunities', page: 'opportunities', icon: <GitBranch size={18} /> },
  { label: 'Buyers', page: 'buyers', icon: <UserCheck size={18} />, requiredPermission: 'canViewBuyers' },
  { label: 'Sellers', page: 'sellers', icon: <Home size={18} />, requiredPermission: 'canViewBuyers' },
  { label: 'Activity Log', page: 'activity-log', icon: <Activity size={18} />, requiredPermission: 'canViewActivityLog' },
  { label: 'Notifications', page: 'notifications', icon: <Bell size={18} /> },
  { label: 'Settings', page: 'settings', icon: <Settings size={18} />, requiredPermission: 'canViewSettings' },
];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: '#1E90FF' },
  agent: { label: 'Agent', color: '#22c55e' },
  viewer: { label: 'Viewer', color: '#94a3b8' },
};

export function Sidebar() {
  const { profile, logout, role, can } = useAuth();
  const { route, navigate } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const unreadCount = useNotificationCount();

  const visibleItems = navItems.filter(item =>
    !item.requiredPermission || can(item.requiredPermission)
  );

  const handleNav = (page: Page) => {
    navigate(page);
    setMobileOpen(false);
  };

  const roleBadge = ROLE_BADGE[role] ?? ROLE_BADGE.viewer;

  const sidebarContent = (
    <div
      className="ssrei-sidebar flex flex-col h-full"
      style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
    >
      <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1E6FA4] rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            SS
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>SSREI</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Real Estate CRM</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = route.page === item.page;
          return (
            <button
              key={item.page}
              onClick={() => handleNav(item.page)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm relative"
              style={{
                backgroundColor: isActive ? 'rgba(30, 111, 164, 0.15)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? '500' : '400',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(30, 111, 164, 0.07)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#1E90FF] rounded-r-full" />
              )}
              <span style={{ color: isActive ? '#1E90FF' : undefined }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.page === 'notifications' && unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-[#1E6FA4]/30 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0">
            {(profile?.full_name || profile?.display_name)?.[0] ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {profile?.full_name || profile?.display_name || 'User'}
            </div>
            <div className="text-xs font-medium" style={{ color: roleBadge.color }}>
              {roleBadge.label}
            </div>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(30, 111, 164, 0.07)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg"
        style={{ backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className="hidden lg:flex flex-col w-56 min-h-screen fixed left-0 top-0 bottom-0 z-40">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-56 flex-shrink-0">{sidebarContent}</div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
