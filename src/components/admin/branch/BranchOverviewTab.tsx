'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Branch, BranchEmployee } from './types';
import { Users, UserCheck, UserX, Clock, Activity, PowerOff, Briefcase, Timer } from 'lucide-react';

interface BranchOverviewTabProps {
  branch: Branch;
  employees: BranchEmployee[];
  onSelectTab?: (tab: string, employeeId?: string) => void;
}

export const BranchOverviewTab: React.FC<BranchOverviewTabProps> = ({ branch, employees = [], onSelectTab }) => {
  const manager = employees.find(e => (branch.manager_id && e.id === branch.manager_id) || (!branch.manager_id && e.role === 'branch_manager'));

  const presentCount = employees.filter(e => e.is_present_today || e.today_status === 'present' || e.today_status === 'late' || e.today_status === 'half-day').length;
  const activeCount = employees.filter(e => e.is_active !== false).length;
  const lateCount = employees.filter(e => e.today_status === 'late').length;
  
  const totalWorkingMinutes = employees.reduce((sum, e) => sum + (e.today_working_minutes || 0), 0);
  const totalOvertimeMinutes = employees.reduce((sum, e) => sum + (e.today_overtime_minutes || 0), 0);
  
  const formatMinutes = (minutes: number) => {
    if (!minutes) return '0 hrs';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const stats = {
    totalEmployees: employees.length,
    present: presentCount,
    absent: employees.length - presentCount,
    late: lateCount,
    active: activeCount,
    offline: employees.length - activeCount,
    todayWorkingHours: formatMinutes(totalWorkingMinutes),
    todayOvertime: formatMinutes(totalOvertimeMinutes),
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Branch Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col space-y-1 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
            <span className="text-sm text-slate-600 font-medium">Branch Name</span>
            <span className="text-xl font-bold text-slate-900">{branch.name}</span>
          </div>
          <div 
            onClick={() => manager && onSelectTab?.('profile', manager.id)}
            className={`flex flex-col space-y-1 p-3 rounded-xl bg-slate-50/60 border border-slate-100 transition-all duration-200 ${manager ? 'cursor-pointer hover:border-[#1dbf73]/40 hover:bg-[#1dbf73]/5 group' : ''}`}
            title={manager ? `Click to view profile for ${manager.full_name}` : 'No manager assigned'}
          >
            <span className="text-sm text-slate-600 font-medium flex items-center justify-between">
              Branch Manager
              {manager && <span className="text-[10px] font-bold text-[#1dbf73] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">View Profile &rarr;</span>}
            </span>
            <span className="text-xl font-bold text-[#1dbf73] group-hover:underline">
              {manager ? manager.full_name : 'No Manager Assigned'}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users />} label="Total Employees" value={stats.totalEmployees} onClick={() => onSelectTab?.('employees')} title="Click to view all branch staff" />
        <StatCard icon={<UserCheck />} label="Present Today" value={stats.present} color="text-[#1dbf73]" onClick={() => onSelectTab?.('attendance')} title="Click to check present attendance" />
        <StatCard icon={<UserX />} label="Absent Today" value={stats.absent} color="text-red-500" onClick={() => onSelectTab?.('attendance')} title="Click to check absent records" />
        <StatCard icon={<Clock />} label="Late Today" value={stats.late} color="text-orange-500" onClick={() => onSelectTab?.('attendance')} title="Click to check late check-ins" />
        
        <StatCard icon={<Activity />} label="Active Now" value={stats.active} color="text-blue-500" onClick={() => onSelectTab?.('employees')} title="Click to check active staff" />
        <StatCard icon={<PowerOff />} label="Offline" value={stats.offline} color="text-slate-500" onClick={() => onSelectTab?.('employees')} title="Click to check offline staff" />
        <StatCard icon={<Briefcase />} label="Today's Hours" value={stats.todayWorkingHours} onClick={() => onSelectTab?.('reports')} title="Click to open branch reports" />
        <StatCard icon={<Timer />} label="Today's Overtime" value={stats.todayOvertime} color="text-purple-500" onClick={() => onSelectTab?.('reports')} title="Click to open overtime analytics" />
      </div>
    </div>
  );
};

function StatCard({ icon, label, value, color = "text-[#1dbf73]", onClick, title }: { icon: React.ReactNode, label: string, value: string | number, color?: string, onClick?: () => void, title?: string }) {
  return (
    <Card 
      onClick={onClick}
      title={title}
      className="bg-white border border-slate-200 p-4 flex flex-col justify-center items-center text-center cursor-pointer hover:-translate-y-1 hover:border-[#1dbf73]/50 hover:shadow-md transition-all duration-300 group"
    >
      <div className={`p-3 rounded-full bg-slate-50 mb-3 group-hover:scale-110 transition-transform ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-600 mb-1 font-medium group-hover:text-slate-900 transition-colors">{label}</p>
      <h4 className="text-2xl font-extrabold text-slate-900 group-hover:scale-105 transition-transform">{value}</h4>
      <span className="text-[10px] font-bold text-slate-400 group-hover:text-[#1dbf73] transition-colors mt-1">View &rarr;</span>
    </Card>
  );
}

