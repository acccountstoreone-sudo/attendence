import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Download, FileSpreadsheet, FileIcon } from 'lucide-react';

export const BranchReportsTab: React.FC = () => {
  const reports = [
    { title: 'Daily Report', description: 'Daily attendance, late marks, and overtimes.' },
    { title: 'Monthly Report', description: 'Complete monthly attendance summary.' },
    { title: 'Employee Report', description: 'List of employees with their current status.' },
    { title: 'Attendance Report', description: 'Detailed check-in/out logs for all employees.' },
    { title: 'Overtime Report', description: 'Overtime hours calculation for payroll.' },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-bold text-white">Branch Reports</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report, idx) => (
          <Card key={idx} className="bg-slate-900 border-slate-800 p-6 flex flex-col h-full shadow-xl">
            <div className="flex items-start space-x-4 mb-4">
               <div className="p-3 bg-slate-950 rounded-lg">
                 <FileText className="w-6 h-6 text-[#D2A02A]" />
               </div>
               <div>
                 <h5 className="text-md font-bold text-white">{report.title}</h5>
                 <p className="text-xs text-slate-400 mt-1">{report.description}</p>
               </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-800/50 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="text-xs flex-1">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
              </Button>
              <Button variant="secondary" size="sm" className="text-xs flex-1">
                <FileIcon className="w-3.5 h-3.5 mr-1 text-red-400" /> PDF
              </Button>
              <Button variant="secondary" size="sm" className="text-xs flex-1">
                <Download className="w-3.5 h-3.5 mr-1" /> CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
