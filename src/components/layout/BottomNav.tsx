'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Clock, History, CalendarDays, User, Store, Users, FileBarChart, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export interface BottomNavProps {
  role: 'branch_manager' | 'employee';
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export const BottomNav: React.FC<BottomNavProps> = ({ role }) => {
  const pathname = usePathname();

  const bmNav: NavItem[] = [
    { label: 'Store', href: '/branch-manager', icon: <Store className="w-6 h-6" /> },
    { label: 'Staff', href: '/branch-manager/employees', icon: <Users className="w-6 h-6" /> },
    { label: 'Live', href: '/branch-manager/attendance', icon: <Clock className="w-6 h-6" /> },
    { label: 'Corrections', href: '/branch-manager/corrections', icon: <UserCheck className="w-6 h-6" /> },
  ];

  const empNav: NavItem[] = [
    { label: 'Dash', href: '/employee', icon: <LayoutDashboard className="w-6 h-6" /> },
    { label: 'Check-In', href: '/employee/check-in', icon: <Clock className="w-6 h-6" /> },
    { label: 'History', href: '/employee/history', icon: <History className="w-6 h-6" /> },
    { label: 'Profile', href: '/employee/profile', icon: <User className="w-6 h-6" /> },
  ];

  const navItems = role === 'branch_manager' ? bmNav : empNav;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#061224]/85 backdrop-blur-xl border-t border-white/[0.05] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isRoot = item.href === '/branch-manager' || item.href === '/employee';
          const isActive = isRoot 
            ? pathname === item.href 
            : (pathname === item.href || pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center w-full h-full space-y-1 group outline-none"
            >
              <div className={cn(
                "relative z-10 p-1 transition-transform duration-200 active:scale-90",
                isActive ? "text-[#D2A02A]" : "text-slate-400 group-hover:text-slate-200"
              )}>
                {item.icon}
                {isActive && (
                  <motion.div
                    layoutId="activeBottomNav"
                    className="absolute inset-0 bg-[#D2A02A]/20 rounded-full blur-md z-0"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-semibold transition-colors duration-200",
                isActive ? "text-[#D2A02A]" : "text-slate-500 group-hover:text-slate-300"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
