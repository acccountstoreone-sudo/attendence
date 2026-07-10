'use client';

import React, { useState } from 'react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useActivePresence } from '@/hooks/useActivePresence';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';
import { Bell, Menu, Store, User as UserIcon, CheckCheck, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export interface HeaderProps {
  user: {
    id: string;
    full_name: string;
    role: string;
    branch_id?: string | null;
    branch_name?: string;
    photo_url?: string | null;
  };
  onOpenMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onOpenMobileSidebar }) => {
  const router = useRouter();
  const supabase = createClient();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const {
    notifications,
    unreadCount,
    latestToast,
    clearToast,
    markAsRead,
    markAllAsRead,
  } = useRealtimeNotifications(user.id);

  // Broadcast user presence globally while the app is open
  useActivePresence(user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="h-20 bg-[#021a0a]/80 backdrop-blur-2xl border-b border-white/[0.03] px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
      {/* Left side: Mobile menu & Branch badge */}
      <div className="flex items-center space-x-3">
        {user.role === 'admin' && (
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 rounded-xl text-green-200 hover:text-white hover:bg-[#0a3a1e] transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        <div className="flex items-center space-x-2 bg-white/[0.02] backdrop-blur-md border border-white/[0.05] px-3 py-1.5 rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
          <Store className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            {user.role === 'admin' ? 'HQ & Universal Access' : user.branch_name || 'Assigned Store'}
          </span>
          <Badge status="active" variant="subtle" className="hidden sm:inline-flex ml-2" />
        </div>
      </div>

      {/* Right side: Notifications & User Avatar */}
      <div className="flex items-center space-x-3 relative">
        {/* Realtime Toast Banner */}
        {latestToast && (
          <div className="fixed bottom-6 right-6 z-50">
            <Toast
              title={latestToast.title}
              message={latestToast.message}
              type={latestToast.type}
              onDismiss={clearToast}
            />
          </div>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
              setShowUserMenu(false);
            }}
            className="p-2.5 rounded-xl bg-[#010e05]/80 border border-[#0a3a1e] text-green-200 hover:text-white hover:bg-[#0a3a1e] transition-all relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#004417] text-white font-extrabold text-[10px] rounded-full flex items-center justify-center animate-bounce shadow-md border border-green-400/30">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#010e05]/95 backdrop-blur-3xl border border-white/5 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden z-30 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-white uppercase tracking-wider">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-[#004417]/20 text-green-400 border border-[#004417]/30 text-xs font-bold rounded-full shadow-[0_0_10px_rgba(0,68,23,0.2)]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-xs text-green-400 hover:text-green-300 flex items-center space-x-1 font-medium"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#0a3a1e]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No notifications to display.
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markAsRead(n.id)}
                      className={`p-3.5 transition-colors cursor-pointer flex items-start space-x-3 border-b border-white/[0.02] last:border-0 ${
                        n.is_read ? 'bg-transparent opacity-70' : 'bg-white/[0.03] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          n.type === 'alert' ? 'bg-rose-500' : n.type === 'warning' ? 'bg-amber-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-green-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white truncate">{n.title}</p>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                        {n.link_url && (
                          <a
                            href={n.link_url}
                            className="inline-flex items-center space-x-1 text-[10px] text-green-400 hover:underline mt-1 font-semibold"
                          >
                            <span>View details</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifMenu(false);
            }}
            className="flex items-center space-x-2.5 p-1.5 rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/[0.05] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:border-[#004417]/30 hover:shadow-[0_0_15px_rgba(0,68,23,0.2)] transition-all outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#004417] to-[#006622] flex items-center justify-center text-white font-extrabold text-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
              {user.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo_url} alt={user.full_name} className="w-full h-full rounded-lg object-cover" />
              ) : (
                user.full_name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="hidden lg:flex flex-col text-left pr-2">
              <span className="text-xs font-bold text-white truncate max-w-[140px] tracking-tight">{user.full_name}</span>
              <span className="text-[10px] text-green-400 uppercase tracking-widest font-bold truncate">{user.role.replace('_', ' ')}</span>
            </div>
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-3 w-64 bg-[#010e05]/95 backdrop-blur-3xl border border-white/5 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_20px_40px_rgba(0,0,0,0.6)] py-1 z-30 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="px-4 py-4 border-b border-white/5 bg-white/[0.02]">
                <p className="text-sm font-bold text-white tracking-tight">{user.full_name}</p>
                <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-1">{user.role.replace('_', ' ')}</p>
              </div>

              <div className="p-2">
                <button
                  onClick={() => router.push(`/${user.role === 'admin' ? 'admin' : user.role === 'branch_manager' ? 'branch-manager' : 'employee'}/profile`)}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors group outline-none"
                >
                  <UserIcon className="w-4 h-4 text-green-700 group-hover:text-green-400 transition-colors" />
                  <span>Account Settings</span>
                </button>
              </div>

              <div className="p-2 border-t border-white/5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors group outline-none"
                >
                  <span className="group-hover:translate-x-1 transition-transform">Sign Out of Portal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

