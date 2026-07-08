import React from 'react';
import { Card } from '@/components/ui/Card';
import { Branch, BranchEmployee } from './types';
import { Users, UserCheck, UserX, Clock, Activity, PowerOff, Briefcase, Timer } from 'lucide-react';

interface BranchOverviewTabProps {
  branch: Branch;
  employees: BranchEmployee[];
}

export const BranchOverviewTab: React.FC<BranchOverviewTabProps> = ({ branch, employees }) => {
  const manager = employees.find(e => e.id === branch.manager_id || e.role === 'branch_manager');

  // Placeholder stats - in a real implementation these would be fetched from the server
  const stats = {
    totalEmployees: employees.length,
    present: Math.floor(employees.length * 0.8),
    absent: Math.floor(employees.length * 0.1),
    late: Math.floor(employees.length * 0.1),
    active: Math.floor(employees.length * 0.7),
    offline: Math.floor(employees.length * 0.3),
    todayWorkingHours: '124 hrs',
    todayOvertime: '12 hrs',
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Branch Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-slate-400">Branch Name</span>
            <span className="text-xl font-semibold text-white">{branch.name}</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-sm text-slate-400">Branch Manager</span>
            <span className="text-xl font-semibold text-[#D2A02A]">
              {manager ? manager.full_name : 'No Manager Assigned'}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users />} label="Total Employees" value={stats.totalEmployees} />
        <StatCard icon={<UserCheck />} label="Present Today" value={stats.present} color="text-emerald-500" />
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

function StatCard({ icon, label, value, color = "text-[#D2A02A]" }: { icon: React.ReactNode, label: string, value: string | number, color?: string }) {
  return (
    <Card className="bg-slate-900 border-slate-800 p-4 flex flex-col justify-center items-center text-center">
      <div className={`p-3 rounded-full bg-slate-950 mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <h4 className="text-2xl font-bold text-white">{value}</h4>
    </Card>
  );
}
