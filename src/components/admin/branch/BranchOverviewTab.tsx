'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Branch, BranchEmployee } from './types';
import { Users, UserCheck, UserX, Clock, Activity, PowerOff, Briefcase, Timer } from 'lucide-react';

interface BranchOverviewTabProps {
  branch: Branch;
  employees: BranchEmployee[];
}

export const BranchOverviewTab: React.FC<BranchOverviewTabProps> = ({ branch, employees = [] }) => {
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
      <Card className="bg-white border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Branch Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-slate-600">Branch Name</span>
            <span className="text-xl font-semibold text-slate-900">{branch.name}</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-slate-600">Branch Manager</span>
            <span className="text-xl font-semibold text-[#1dbf73]">
              {manager ? manager.full_name : 'No Manager Assigned'}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users />} label="Total Employees" value={stats.totalEmployees} />
        <StatCard icon={<UserCheck />} label="Present Today" value={stats.present} color="text-[#1dbf73]" />
        <StatCard icon={<UserX />} label="Absent Today" value={stats.absent} color="text-red-500" />
        <StatCard icon={<Clock />} label="Late Today" value={stats.late} color="text-orange-500" />
        
        <StatCard icon={<Activity />} label="Active Now" value={stats.active} color="text-blue-500" />
        <StatCard icon={<PowerOff />} label="Offline" value={stats.offline} color="text-slate-500" />
        <StatCard icon={<Briefcase />} label="Today's Hours" value={stats.todayWorkingHours} />
        <StatCard icon={<Timer />} label="Today's Overtime" value={stats.todayOvertime} color="text-purple-500" />
      </div>
    </div>
  );
};

function StatCard({ icon, label, value, color = "text-[#1dbf73]" }: { icon: React.ReactNode, label: string, value: string | number, color?: string }) {
  return (
    <Card className="bg-white border-slate-200 p-4 flex flex-col justify-center items-center text-center">
      <div className={`p-3 rounded-full bg-white mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
    </Card>
  );
}

