import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BranchEmployee, Branch } from './types';
import { ChevronLeft, User, Phone, MapPin, Calendar, Clock, Map, Camera, Loader2, Download, FileText, MessageSquare, Building2 } from 'lucide-react';

interface BranchEmployeeProfileTabProps {
  employeeId: string;
  employees: BranchEmployee[];
  branch: Branch;
  onBack: () => void;
  onViewFullHistory?: () => void;
}

export const BranchEmployeeProfileTab: React.FC<BranchEmployeeProfileTabProps> = ({ employeeId, employees, branch, onBack, onViewFullHistory }) => {
  const employee = employees.find(e => e.id === employeeId);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<'all' | 'month' | null>(null);

  useEffect(() => {
    async function fetchEmployeeAttendance() {
      if (!employeeId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/attendance/history?employee_id=${employeeId}&limit=100`);
        if (res.ok) {
          const json = await res.json();
          setRecords(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch employee attendance:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEmployeeAttendance();
  }, [employeeId]);

  const handleExportPDF = async (mode: 'all' | 'month') => {
    if (!employeeId) return;
    setExporting(mode);
    try {
      const url = mode === 'all'
        ? `/api/reports/employee/${employeeId}/export?format=pdf&all_time=true`
        : `/api/reports/employee/${employeeId}/export?format=pdf`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to generate PDF report');
      }
      if (json.data?.content_base64) {
        const byteCharacters = atob(json.data.content_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = json.data.file_name || `${employee?.full_name || 'Employee'}_Summary_Report.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (err: any) {
      alert(`Export Failed: ${err.message || String(err)}`);
    } finally {
      setExporting(null);
    }
  };

  if (!employee) {
    return (
      <div className="text-center py-12 text-slate-900">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Employee not found.</p>
        <Button variant="secondary" onClick={onBack} className="mt-4">Back to Employees</Button>
      </div>
    );
  }

  // Calculate stats dynamically from actual attendance records
  const totalPresent = records.filter(r => {
    const st = (r.status || '').toLowerCase().replace('_', '-');
    return st === 'present' || st === 'late' || st === 'half-day';
  }).length;
  const totalAbsent = records.filter(r => (r.status || '').toLowerCase() === 'absent').length;
  
  const totalWorkingHours = records.reduce((acc, r) => {
    if (r.check_in_time && r.check_out_time) {
      const diffHrs = (new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / (1000 * 60 * 60);
      return acc + (diffHrs > 0 ? diffHrs : 0);
    } else if (r.check_in_time && !r.check_out_time) {
      const checkInDate = new Date(r.check_in_time);
      if (checkInDate.toDateString() === new Date().toDateString()) {
        const diffHrs = (new Date().getTime() - checkInDate.getTime()) / (1000 * 60 * 60);
        return acc + (diffHrs > 0 ? diffHrs : 0);
      } else {
        const st = (r.status || '').toLowerCase().replace('_', '-');
        const fallback = r.working_minutes ? r.working_minutes / 60 : st === 'half-day' ? 4 : 8;
        return acc + fallback;
      }
    }
    return acc;
  }, 0);

  const totalOvertimeHours = records.reduce((acc, r) => {
    const mins = r.approved_overtime_minutes !== null && r.approved_overtime_minutes !== undefined 
      ? Number(r.approved_overtime_minutes) 
      : Number(r.overtime_minutes || 0);
    return acc + (mins / 60);
  }, 0);

  const isPresentToday = employee.is_present_today || employee.today_status === 'present' || employee.today_status === 'late' || employee.today_status === 'half-day';

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-900 hover:text-slate-900 p-0 h-auto">
          <ChevronLeft className="w-5 h-5 mr-1" /> Back
        </Button>
        <h3 className="text-xl font-bold text-slate-900">Employee Profile</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Personal Info */}
        <Card className="bg-white border-slate-200 p-6 md:col-span-1">
          <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200">
            <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center overflow-hidden mb-4 border-2 border-slate-200">
              {(employee.photo_url || employee.profile_picture) ? (
                <img src={employee.photo_url || employee.profile_picture} alt={employee.full_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-slate-500" />
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{employee.full_name}</h2>
            <p className="text-[#1dbf73] text-sm font-medium mt-1 uppercase tracking-wider">{employee.role.replace(/_/g, ' ')}</p>
            <div className="flex items-center justify-center space-x-2 mt-3">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-900">
                ID: {employee.employee_id || employee.id.slice(0,8)}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                isPresentToday ? 'bg-[#1dbf73]/10 text-[#1dbf73]' : employee.is_active !== false ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
              }`}>
                {isPresentToday ? 'Present Today' : employee.is_active !== false ? 'Active Account' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="pt-6 space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Contact & Assignment</h4>
            <div className="flex items-center space-x-3 text-sm font-bold text-[#1dbf73] bg-[#1dbf73]/10 px-3 py-2 rounded-lg">
              <MessageSquare className="w-4 h-4 text-[#1dbf73] fill-current shrink-0" />
              <span>WhatsApp: {employee.whatsapp_number || employee.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-900 px-1">
              <Phone className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Phone: {employee.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-900 px-1">
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="break-all">{employee.email}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm font-semibold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/60">
              <Building2 className="w-4 h-4 text-[#1dbf73] shrink-0" />
              <span>Branch: {branch.name || employee.branch_name || 'Assigned Branch'}</span>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <Button
                size="sm"
                variant="outline"
                disabled={exporting !== null}
                onClick={() => handleExportPDF('all')}
                className="w-full text-xs font-semibold text-[#1dbf73] border-[#1dbf73]/30 hover:bg-[#1dbf73] hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {exporting === 'all' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exporting === 'all' ? 'Generating PDF...' : 'Download Profile & Duty PDF'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Column - Attendance & History */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-white border-slate-200 p-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
               <h4 className="text-lg font-bold text-slate-900 flex items-center"><Calendar className="w-5 h-5 mr-2 text-[#1dbf73]" /> Attendance Summary</h4>
               <div className="flex items-center gap-2">
                 <Button
                   size="sm"
                   disabled={exporting !== null}
                   onClick={() => handleExportPDF('month')}
                   className="bg-[#1dbf73] text-white hover:bg-[#19a362] text-xs font-semibold shadow-2xs flex items-center gap-1.5"
                 >
                   {exporting === 'month' ? (
                     <Loader2 className="w-3.5 h-3.5 animate-spin" />
                   ) : (
                     <FileText className="w-3.5 h-3.5" />
                   )}
                   {exporting === 'month' ? 'Exporting...' : 'Export Monthly PDF'}
                 </Button>
                 <Button
                   size="sm"
                   variant="outline"
                   disabled={exporting !== null}
                   onClick={() => handleExportPDF('all')}
                   className="text-xs font-semibold text-slate-700 hover:border-slate-400 flex items-center gap-1.5"
                 >
                   {exporting === 'all' ? (
                     <Loader2 className="w-3.5 h-3.5 animate-spin" />
                   ) : (
                     <Download className="w-3.5 h-3.5 text-[#1dbf73]" />
                   )}
                   {exporting === 'all' ? 'Exporting...' : 'All Time PDF'}
                 </Button>
               </div>
             </div>
             {loading ? (
               <div className="py-6 flex justify-center items-center">
                 <Loader2 className="w-6 h-6 animate-spin text-[#1dbf73]" />
                 <span className="ml-2 text-xs text-slate-500">Calculating statistics...</span>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-white p-4 rounded-lg text-center border border-slate-100 shadow-xs">
                   <p className="text-xs text-slate-900">Total Present</p>
                   <p className="text-xl font-bold text-[#1dbf73] mt-1">{totalPresent} days</p>
                 </div>
                 <div className="bg-white p-4 rounded-lg text-center border border-slate-100 shadow-xs">
                   <p className="text-xs text-slate-900">Total Absent</p>
                   <p className="text-xl font-bold text-red-500 mt-1">{totalAbsent} days</p>
                 </div>
                 <div className="bg-white p-4 rounded-lg text-center border border-slate-100 shadow-xs">
                   <p className="text-xs text-slate-900">Working Hours</p>
                   <p className="text-xl font-bold text-blue-500 mt-1">{Number(totalWorkingHours.toFixed(1))} hrs</p>
                 </div>
                 <div className="bg-white p-4 rounded-lg text-center border border-slate-100 shadow-xs">
                   <p className="text-xs text-slate-900">Overtime</p>
                   <p className="text-xl font-bold text-purple-500 mt-1">{Number(totalOvertimeHours.toFixed(1))} hrs</p>
                 </div>
               </div>
             )}
          </Card>

          <Card className="bg-white border-slate-200 p-6">
             <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center"><Clock className="w-5 h-5 mr-2 text-[#1dbf73]" /> Recent History</h4>
             {loading ? (
               <div className="py-8 flex justify-center items-center">
                 <Loader2 className="w-6 h-6 animate-spin text-[#1dbf73]" />
                 <span className="ml-2 text-xs text-slate-500">Loading recent check-ins...</span>
               </div>
             ) : records.length === 0 ? (
               <div className="py-8 text-center text-slate-500 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                 <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                 <p className="text-sm font-medium">No check-in history found for this employee.</p>
                 <p className="text-xs text-slate-400 mt-1">Check-ins will appear here dynamically once recorded.</p>
               </div>
             ) : (
               <div className="space-y-3">
                 {records.slice(0, 5).map((record) => {
                   const checkInDate = new Date(record.check_in_time);
                   const timeStr = checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                   const isToday = checkInDate.toDateString() === new Date().toDateString();
                   const dateStr = isToday ? 'Today' : checkInDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                   const locationName = record.branches?.name || branch.name || 'Branch Office';

                   return (
                     <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-lg border border-slate-200/60 hover:border-slate-300 transition-all shadow-xs">
                       <div>
                         <p className="text-sm font-semibold text-slate-900">Check-in at {locationName}</p>
                         <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                           <span className="flex items-center"><Map className="w-3 h-3 mr-1 text-emerald-600" /> {record.is_manual_override ? 'Manual Override' : 'GPS Verified'}</span>
                           <span className="flex items-center"><Camera className="w-3 h-3 mr-1 text-emerald-600" /> {record.face_verified ? 'Face Verified' : 'Standard Auth'}</span>
                           <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                             record.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                             record.status === 'late' ? 'bg-amber-50 text-amber-700' :
                             record.status === 'absent' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                           }`}>
                             {record.status || 'present'}
                           </span>
                         </div>
                       </div>
                       <div className="mt-2 sm:mt-0 text-left sm:text-right shrink-0">
                         <p className="text-sm font-bold text-[#1dbf73]">{timeStr}</p>
                         <p className="text-xs font-medium text-slate-500">{dateStr}</p>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
             <div className="flex flex-col sm:flex-row gap-2 mt-4">
               <Button 
                 variant="outline" 
                 className="flex-1 text-xs font-medium hover:bg-[#1dbf73]/10 hover:text-[#1dbf73] hover:border-[#1dbf73] transition-all"
                 onClick={() => {
                   if (onViewFullHistory) {
                     onViewFullHistory();
                   } else {
                     onBack();
                   }
                 }}
               >
                 View Full Check-in/out History &rarr;
               </Button>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};


