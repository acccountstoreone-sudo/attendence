'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BranchEmployee } from './types';
import { UserCheck, User, Circle } from 'lucide-react';

interface BranchEmployeesTabProps {
  employees: BranchEmployee[];
  onViewProfile: (employeeId: string) => void;
}

export const BranchEmployeesTab: React.FC<BranchEmployeesTabProps> = ({ employees, onViewProfile }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-slate-900">Employees ({employees.length})</h4>
      </div>
      
      <Card className="bg-white border-slate-200 overflow-hidden shadow-xl">
        {employees.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <UserCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium">No employees assigned to this branch yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Employee</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">ID & Phone</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Designation</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Attendance</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {emp.profile_picture ? (
                            <img src={emp.profile_picture} alt={emp.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{emp.full_name}</div>
                          <div className="text-xs text-slate-500">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600">{emp.employee_id || 'N/A'}</div>
                      <div className="text-xs text-slate-500 mt-1">{emp.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-600">
                        {emp.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5">
                        <Circle className={`w-2.5 h-2.5 fill-current ${emp.is_present_today ? 'text-[#1dbf73]' : 'text-slate-500'}`} />
                        <span className="text-xs font-medium text-slate-600">{emp.is_present_today ? 'Active' : 'Offline'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        emp.is_present_today 
                          ? 'bg-[#1dbf73]/10 text-[#1dbf73] border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {emp.is_present_today ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        onClick={() => onViewProfile(emp.id)}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

