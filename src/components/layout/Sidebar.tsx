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
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-sm border-r border-slate-200 text-slate-800 select-none shadow-sm">
      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-slate-200 shrink-0 relative overflow-hidden bg-slate-50/50">
        <div className="flex items-center space-x-3 overflow-hidden relative z-10">
          <div className="w-10 h-10 rounded-xl bg-[#1dbf73] flex items-center justify-center text-slate-900 font-extrabold shadow-sm shrink-0">
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
                <span className="font-bold text-slate-900 tracking-tight truncate whitespace-nowrap">Anchor Fashion</span>
                <span className="text-[10px] text-[#1dbf73] font-bold uppercase tracking-wider truncate">
                  {role.replace('_', ' ')} Portal
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse button for Desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {navItems.map((item) => {
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
                  ? 'text-[#1dbf73] font-bold bg-[#1dbf73]/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavBackground"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-[#1dbf73] rounded-r-full shadow-sm z-0"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <div className={cn('relative z-10 shrink-0 transition-all duration-300 group-hover:scale-110', isActive ? 'text-[#1dbf73]' : 'text-slate-500 group-hover:text-slate-900')}>
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
      <div className="p-4 border-t border-slate-200 shrink-0 bg-slate-50/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors group"
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
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative w-72 h-full z-10 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

