'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Store,
  Users,
  Clock,
  FileBarChart,
  Settings,
  ShieldAlert,
  UserCheck,
  History,
  CalendarDays,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export interface SidebarProps {
  role: 'admin' | 'branch_manager' | 'employee';
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const adminNav: NavItem[] = [
    { label: 'HQ Dashboard', href: '/admin', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'All Branches', href: '/admin/branches', icon: <Store className="w-5 h-5" /> },
    { label: 'Duty Hours', href: '/admin/duty-hours', icon: <Clock className="w-5 h-5" /> },
    { label: 'Employees', href: '/admin/employees', icon: <Users className="w-5 h-5" /> },
    { label: 'Attendance Live', href: '/admin/attendance', icon: <Clock className="w-5 h-5" /> },
    { label: 'Reports & Exports', href: '/admin/reports', icon: <FileBarChart className="w-5 h-5" /> },
    { label: 'Leave Requests', href: '/admin/leaves', icon: <CalendarDays className="w-5 h-5" /> },
    { label: 'Manual Corrections', href: '/admin/corrections', icon: <UserCheck className="w-5 h-5" /> },
    { label: 'Payroll', href: '/admin/payroll', icon: <FileBarChart className="w-5 h-5" /> },
    { label: 'Salary Settings', href: '/admin/salary-settings', icon: <DollarSign className="w-5 h-5" /> },
    { label: 'Analytics', href: '/admin/analytics', icon: <TrendingUp className="w-5 h-5" /> },
    { label: 'Public Holidays', href: '/admin/holidays', icon: <CalendarDays className="w-5 h-5" /> },
    { label: 'Company Policy', href: '/admin/settings', icon: <Settings className="w-5 h-5" /> },
    { label: 'Audit Logs', href: '/admin/audit', icon: <ShieldAlert className="w-5 h-5" /> },
    { label: 'My Profile', href: '/admin/profile', icon: <User className="w-5 h-5" /> },
  ];

  const bmNav: NavItem[] = [
    { label: 'Store Dashboard', href: '/branch-manager', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'My Branch', href: '/branch-manager/store', icon: <Store className="w-5 h-5" /> },
    { label: 'Store Employees', href: '/branch-manager/employees', icon: <Users className="w-5 h-5" /> },
    { label: 'Attendance Live', href: '/branch-manager/attendance', icon: <Clock className="w-5 h-5" /> },
    { label: 'Leave Requests', href: '/branch-manager/leaves', icon: <CalendarDays className="w-5 h-5" /> },
    { label: 'Shift Roster', href: '/branch-manager/shifts', icon: <CalendarDays className="w-5 h-5" /> },
    { label: 'Store Reports', href: '/branch-manager/reports', icon: <FileBarChart className="w-5 h-5" /> },
    { label: 'Manual Corrections', href: '/branch-manager/corrections', icon: <UserCheck className="w-5 h-5" /> },
    { label: 'My Profile', href: '/branch-manager/profile', icon: <User className="w-5 h-5" /> },
  ];

  const empNav: NavItem[] = [
    { label: 'My Dashboard', href: '/employee', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Biometric Check-In', href: '/employee/check-in', icon: <Clock className="w-5 h-5" /> },
    { label: 'My History', href: '/employee/history', icon: <History className="w-5 h-5" /> },
    { label: 'Leave Requests', href: '/employee/leaves', icon: <CalendarDays className="w-5 h-5" /> },
    { label: 'My Profile', href: '/employee/profile', icon: <User className="w-5 h-5" /> },
  ];

  const navItems = role === 'admin' ? adminNav : role === 'branch_manager' ? bmNav : empNav;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#010e05]/95 backdrop-blur-2xl border-r border-[#0a3a1e] text-green-100 select-none shadow-[4px_0_24px_rgba(0,10,4,0.6)]">
      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-[#0a3a1e] shrink-0 relative overflow-hidden">
        {/* Subtle background glow for header */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,rgba(0,68,23,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="flex items-center space-x-3 overflow-hidden relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004417] to-[#006622] flex items-center justify-center text-white font-extrabold shadow-[0_0_15px_rgba(0,68,23,0.5)] shrink-0 border border-[#00aa44]/30">
            AF
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, width: 0 }} 
                animate={{ opacity: 1, width: 'auto' }} 
                exit={{ opacity: 0, width: 0 }}
                className="flex flex-col min-w-0"
              >
                <span className="font-bold text-white tracking-tight truncate whitespace-nowrap">Anchor Fashion</span>
                <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider truncate">
                  {role.replace('_', ' ')} Portal
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse button for Desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-green-300 hover:text-white hover:bg-[#0a3a1e] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-[#0a3a1e] scrollbar-track-transparent">
        {navItems.map((item) => {
          // If the link is a root dashboard (/admin, /branch-manager, /employee), it must match exactly.
          // Otherwise, it can match exactly or as a sub-path.
          const isRoot = item.href === '/admin' || item.href === '/branch-manager' || item.href === '/employee';
          const isActive = isRoot 
            ? pathname === item.href 
            : (pathname === item.href || pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onCloseMobile()}
              className={cn(
                'relative flex items-center space-x-3 px-3 py-3 rounded-xl font-medium text-sm transition-all duration-300 group outline-none',
                isActive
                  ? 'text-white font-bold'
                  : 'text-green-200/60 hover:text-green-100'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavBackground"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-gradient-to-b from-[#00cc55] to-[#004417] rounded-r-full shadow-[0_0_12px_rgba(0,204,85,0.5)] z-0"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              
              {!isActive && (
                 <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.03] rounded-xl transition-colors duration-300 z-0" />
              )}
              
              {isActive && (
                 <div className="absolute inset-0 bg-gradient-to-r from-white/[0.05] to-transparent rounded-xl z-0" />
              )}

              <div className={cn('relative z-10 shrink-0 transition-all duration-300 group-hover:scale-110', isActive ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'group-hover:text-white')}>
                {item.icon}
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="relative z-10 truncate whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-[#0a3a1e] shrink-0 bg-[#010e05]/40">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors group"
        >
          <LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-nowrap"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:block fixed top-0 bottom-0 left-0 z-30 transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative w-72 h-full z-10 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

