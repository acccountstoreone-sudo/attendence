import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BranchEmployee, Branch } from './types';
import { ChevronLeft, User, Phone, MapPin, Calendar, Clock, Map, Camera } from 'lucide-react';

interface BranchEmployeeProfileTabProps {
  employeeId: string;
  employees: BranchEmployee[];
  branch: Branch;
  onBack: () => void;
}

export const BranchEmployeeProfileTab: React.FC<BranchEmployeeProfileTabProps> = ({ employeeId, employees, branch, onBack }) => {
  const employee = employees.find(e => e.id === employeeId);

  if (!employee) {
    return (
      <div className="text-center py-12 text-slate-400">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Employee not found.</p>
        <Button variant="secondary" onClick={onBack} className="mt-4">Back to Employees</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white p-0 h-auto">
          <ChevronLeft className="w-5 h-5 mr-1" /> Back
        </Button>
        <h3 className="text-xl font-bold text-white">Employee Profile</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Personal Info */}
        <Card className="bg-slate-900 border-slate-800 p-6 md:col-span-1">
          <div className="flex flex-col items-center text-center pb-6 border-b border-slate-800">
            <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden mb-4 border-2 border-slate-700">
              {employee.profile_picture ? (
                <img src={employee.profile_picture} alt={employee.full_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-slate-500" />
              )}
            </div>
            <h2 className="text-xl font-bold text-white">{employee.full_name}</h2>
            <p className="text-[#D2A02A] text-sm font-medium mt-1 uppercase tracking-wider">{employee.role.replace('_', ' ')}</p>
            <div className="flex items-center justify-center space-x-2 mt-3">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                ID: {employee.employee_id || employee.id.slice(0,8)}
              </span>
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${employee.is_active !== false ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                {employee.is_active !== false ? 'Active Now' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="pt-6 space-y-4">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Contact Info</h4>
            <div className="flex items-center space-x-3 text-sm text-slate-300">
              <Phone className="w-4 h-4 text-slate-500" />
              <span>{employee.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-300">
              <User className="w-4 h-4 text-slate-500" />
              <span className="break-all">{employee.email}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-slate-300">
              <MapPin className="w-4 h-4 text-slate-500" />
              <span>{branch.name}</span>
            </div>
          </div>
        </Card>

        {/* Right Column - Attendance & History */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 p-6">
             <h4 className="text-lg font-bold text-white mb-4 flex items-center"><Calendar className="w-5 h-5 mr-2 text-[#D2A02A]" /> Attendance Summary</h4>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="bg-slate-950 p-4 rounded-lg text-center">
                 <p className="text-xs text-slate-400">Total Present</p>
                 <p className="text-xl font-bold text-emerald-500 mt-1">24 days</p>
               </div>
               <div className="bg-slate-950 p-4 rounded-lg text-center">
                 <p className="text-xs text-slate-400">Total Absent</p>
                 <p className="text-xl font-bold text-red-500 mt-1">2 days</p>
               </div>
               <div className="bg-slate-950 p-4 rounded-lg text-center">
                 <p className="text-xs text-slate-400">Working Hours</p>
                 <p className="text-xl font-bold text-blue-500 mt-1">192 hrs</p>
               </div>
               <div className="bg-slate-950 p-4 rounded-lg text-center">
                 <p className="text-xs text-slate-400">Overtime</p>
                 <p className="text-xl font-bold text-purple-500 mt-1">15 hrs</p>
               </div>
             </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-6">
             <h4 className="text-lg font-bold text-white mb-4 flex items-center"><Clock className="w-5 h-5 mr-2 text-[#D2A02A]" /> Recent History</h4>
             <div className="space-y-4">
               {/* Placeholder List */}
               {[1, 2, 3].map((i) => (
                 <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-white">Check-in at Headquarters</p>
                      <div className="flex items-center space-x-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center"><Map className="w-3 h-3 mr-1" /> GPS Verified</span>
                        <span className="flex items-center"><Camera className="w-3 h-3 mr-1" /> Face Verified</span>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 text-left sm:text-right">
                      <p className="text-sm font-bold text-[#D2A02A]">09:00 AM</p>
                      <p className="text-xs text-slate-500">Today</p>
                    </div>
                 </div>
               ))}
             </div>
             <Button variant="outline" className="w-full mt-4 text-xs">View Full Check-in/out History</Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
