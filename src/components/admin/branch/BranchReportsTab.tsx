import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Download, FileSpreadsheet, FileIcon } from 'lucide-react';

export const BranchReportsTab: React.FC = () => {
  const reports: { title: string; description: string }[] = [];

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-bold text-slate-900">Branch Reports</h4>
      
      {reports.length === 0 ? (
        <Card className="bg-white border-slate-200 p-12 flex flex-col items-center justify-center shadow-xl text-center">
          <FileText className="w-12 h-12 text-slate-700 mb-4" />
          <h5 className="text-md font-medium text-slate-600">No reports generated</h5>
          <p className="text-sm text-slate-500 mt-1">Reports will appear here once data is collected.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, idx) => (
            <Card key={idx} className="bg-white border-slate-200 p-6 flex flex-col h-full shadow-xl">
              <div className="flex items-start space-x-4 mb-4">
                 <div className="p-3 bg-white rounded-lg">
                   <FileText className="w-6 h-6 text-[#1dbf73]" />
                 </div>
                 <div>
                   <h5 className="text-md font-bold text-slate-900">{report.title}</h5>
                   <p className="text-xs text-slate-600 mt-1">{report.description}</p>
                 </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-slate-200/50 flex flex-wrap gap-2">
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
      )}
    </div>
  );
};

