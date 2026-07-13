'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ChevronLeft, Store, LayoutDashboard, Users, Calendar, FileText, Settings, Bell, Clock } from 'lucide-react';
import { Branch, BranchEmployee } from '@/components/admin/branch/types';

import { BranchOverviewTab } from '@/components/admin/branch/BranchOverviewTab';
import { BranchEmployeesTab } from '@/components/admin/branch/BranchEmployeesTab';
import { BranchEmployeeProfileTab } from '@/components/admin/branch/BranchEmployeeProfileTab';
import { BranchAttendanceTab } from '@/components/admin/branch/BranchAttendanceTab';
import { BranchReportsTab } from '@/components/admin/branch/BranchReportsTab';
import { BranchSettingsTab } from '@/components/admin/branch/BranchSettingsTab';
import { BranchAnnouncementTab } from '@/components/admin/branch/BranchAnnouncementTab';
import { BranchGatePassTab } from '@/components/admin/branch/BranchGatePassTab';
import { Card } from '@/components/ui/Card';

type TabType = 'overview' | 'employees' | 'profile' | 'attendance' | 'reports' | 'settings' | 'announcements' | 'gate_pass';

export default function BranchWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [employees, setEmployees] = useState<BranchEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData(id: string) {
      setLoading(true);
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) {
        setBranch(data);
      } else if (error) {
        console.error(error);
      }

      try {
        const res = await fetch(`/api/employees?branch_id=${id}`);
        if (res.ok) {
          const json = await res.json();
          const mapped: BranchEmployee[] = (json.data || []).map((e: Record<string, unknown>) => ({
            ...e,
            profile_picture: e.photo_url as string,
            is_active: e.is_active as boolean,
            is_present_today: !!e.is_present_today,
            today_status: e.today_status as string,
            today_working_minutes: e.today_working_minutes as number,
            today_overtime_minutes: e.today_overtime_minutes as number
          }));
          setEmployees(mapped);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }

    params.then((p) => {
      loadData(p.id);
    });
  }, [params, supabase]);

  const handleViewProfile = (empId: string) => {
    setSelectedEmployeeId(empId);
    setActiveTab('profile');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1dbf73]"></div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="text-center py-12">
        <Store className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Branch Not Found</h2>
        <button onClick={() => router.push('/admin/branches')} className="text-[#1dbf73] hover:underline">Go Back</button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4 mr-2" /> },
    { id: 'employees', label: 'Employees', icon: <Users className="w-4 h-4 mr-2" /> },
    { id: 'gate_pass', label: 'Gate-Pass & Breaks', icon: <Clock className="w-4 h-4 mr-2 text-[#1dbf73]" /> },
    { id: 'attendance', label: 'Attendance', icon: <Calendar className="w-4 h-4 mr-2" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4 mr-2" /> },
    { id: 'announcements', label: 'Announcements', icon: <Bell className="w-4 h-4 mr-2" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4 mr-2" /> },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link href="/admin/branches" className="flex items-center text-slate-600 hover:text-slate-900 transition-colors text-sm mb-2 w-fit">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to All Branches
          </Link>
          <div className="flex items-center space-x-2 text-[#1dbf73] text-xs font-bold uppercase tracking-widest mb-1">
            <Store className="w-4 h-4" />
            <span>Workspace</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {branch.name} <span className="text-xl text-slate-500 font-normal">({branch.code})</span>
          </h1>
        </div>
      </div>

      {/* Quick Statistics Top Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
         <div 
           onClick={() => setActiveTab('employees')}
           className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1dbf73]/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
           title="Click to view all branch staff"
         >
            <span className="text-xs text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Total Staff</span>
            <span className="text-lg font-bold text-slate-900 group-hover:scale-105 transition-transform">{employees.length}</span>
         </div>
         <div 
           onClick={() => setActiveTab('attendance')}
           className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1dbf73]/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
           title="Click to view present check-ins in Attendance tab"
         >
            <span className="text-xs text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Present</span>
            <span className="text-lg font-bold text-[#1dbf73] group-hover:scale-105 transition-transform">{employees.filter(e => e.is_present_today || e.today_status === 'present' || e.today_status === 'late' || e.today_status === 'half-day').length}</span>
         </div>
         <div 
           onClick={() => setActiveTab('attendance')}
           className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-red-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
           title="Click to check absent records in Attendance tab"
         >
            <span className="text-xs text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Absent</span>
            <span className="text-lg font-bold text-red-500 group-hover:scale-105 transition-transform">{employees.length - employees.filter(e => e.is_present_today || e.today_status === 'present' || e.today_status === 'late' || e.today_status === 'half-day').length}</span>
         </div>
         <div 
           onClick={() => setActiveTab('employees')}
           className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
           title="Click to check active staff in Employees tab"
         >
            <span className="text-xs text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Active Now</span>
            <span className="text-lg font-bold text-blue-500 group-hover:scale-105 transition-transform">{employees.filter(e => e.is_active !== false).length}</span>
         </div>
         <div 
           onClick={() => setActiveTab('attendance')}
           className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-orange-500/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
           title="Click to check late check-ins in Attendance tab"
         >
            <span className="text-xs text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Late</span>
            <span className="text-lg font-bold text-orange-500 group-hover:scale-105 transition-transform">{employees.filter(e => e.today_status === 'late').length}</span>
         </div>
         <div 
           onClick={() => setActiveTab('overview')}
           className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1dbf73]/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group"
           title="Click to view branch overview stats"
         >
            <span className="text-xs text-slate-600 group-hover:text-slate-900 font-medium transition-colors">Attendance %</span>
            <span className="text-lg font-bold text-[#1dbf73] group-hover:scale-105 transition-transform">
              {employees.length > 0 ? Math.round((employees.filter(e => e.is_present_today || e.today_status === 'present' || e.today_status === 'late' || e.today_status === 'half-day').length / employees.length) * 100) : 0}%
            </span>
         </div>
      </div>

      {/* Tab Navigation */}
      <Card className="bg-white/80 border-slate-200 backdrop-blur-md p-1 sticky top-0 z-10 overflow-x-auto shadow-2xl">
        <div className="flex space-x-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id || (tab.id === 'employees' && activeTab === 'profile')
                  ? 'bg-[#1dbf73]/10 text-[#1dbf73] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <BranchOverviewTab 
            branch={branch} 
            employees={employees} 
            onSelectTab={(tab, empId) => {
              if (tab === 'profile' && empId) {
                handleViewProfile(empId);
              } else {
                setActiveTab(tab as TabType);
              }
            }} 
          />
        )}
        {activeTab === 'employees' && <BranchEmployeesTab employees={employees} onViewProfile={handleViewProfile} />}
        {activeTab === 'profile' && selectedEmployeeId && (
          <BranchEmployeeProfileTab 
            employeeId={selectedEmployeeId} 
            employees={employees} 
            branch={branch}
            onBack={() => setActiveTab('employees')} 
          />
        )}
        {activeTab === 'attendance' && <BranchAttendanceTab branch={branch} />}
        {activeTab === 'gate_pass' && <BranchGatePassTab branch={branch} />}
        {activeTab === 'reports' && <BranchReportsTab branch={branch} />}
        {activeTab === 'settings' && <BranchSettingsTab branch={branch} />}
        {activeTab === 'announcements' && <BranchAnnouncementTab branch={branch} employees={employees} />}
      </div>
    </div>
  );
}
