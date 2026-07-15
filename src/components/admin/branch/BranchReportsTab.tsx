import React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Download, FileSpreadsheet, FileIcon } from 'lucide-react';

import { Branch } from './types';

interface BranchReportsTabProps {
  branch: Branch;
}

export const BranchReportsTab: React.FC<BranchReportsTabProps> = ({ branch }) => {
  const router = useRouter();
  const reports = [
    { type: 'monthly_attendance', title: 'Complete Attendance & Duty Report', description: 'Comprehensive view of all attendance records, including late arrivals and overtime analytics for the month.', statusFilter: 'all' }
  ];

  const [exporting, setExporting] = React.useState<string | null>(null);

  const handleExport = async (type: string, format: string) => {
    try {
      setExporting(`${type}-${format}`);
      const now = new Date();
      const url = `/api/reports/export?branch_id=${branch.id}&type=${type}&format=${format}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        let errorMsg = 'Export failed';
        try {
          const errData = await res.json();
          if (errData.error?.message) errorMsg = errData.error.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      let fileName = `Branch_Report_${now.getFullYear()}_${now.getMonth() + 1}.${format === 'excel' ? 'xlsx' : format}`;
      if (contentDisposition && contentDisposition.includes('filename="')) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) fileName = match[1];
      }
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to export report. Please try again.');
    } finally {
      setExporting(null);
    }
  };

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
            <Card 
              key={idx} 
              onClick={() => router.push(`/admin/attendance?status=${report.statusFilter}&tab=all`)}
              className="bg-white border-slate-200 p-6 flex flex-col h-full shadow-xl cursor-pointer hover:border-[#1dbf73]/50 hover:-translate-y-1 transition-all duration-300 group"
              title={`Click to view ${report.title} live logs`}
            >
              <div className="flex items-start space-x-4 mb-4">
                 <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-[#1dbf73]/10 transition-colors">
                   <FileText className="w-6 h-6 text-[#1dbf73]" />
                 </div>
                 <div className="flex-1">
                   <h5 className="text-md font-bold text-slate-900 group-hover:text-[#1dbf73] transition-colors flex items-center justify-between">
                     {report.title}
                     <span className="text-[10px] text-slate-400 group-hover:text-[#1dbf73] font-bold uppercase transition-colors">View &rarr;</span>
                   </h5>
                   <p className="text-xs text-slate-600 mt-1">{report.description}</p>
                 </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-slate-200/50 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" size="sm" className="text-xs flex-1 hover:border-[#1dbf73]/40" onClick={() => handleExport(report.type, 'excel')} isLoading={exporting === `${report.type}-excel`} disabled={exporting !== null}>
                  {!exporting && <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />} Excel
                </Button>
                <Button variant="secondary" size="sm" className="text-xs flex-1 hover:border-red-400/40" onClick={() => handleExport(report.type, 'pdf')} isLoading={exporting === `${report.type}-pdf`} disabled={exporting !== null}>
                  {!exporting && <FileIcon className="w-3.5 h-3.5 mr-1 text-red-500" />} PDF
                </Button>
                <Button variant="secondary" size="sm" className="text-xs flex-1 hover:border-blue-400/40" onClick={() => handleExport(report.type, 'csv')} isLoading={exporting === `${report.type}-csv`} disabled={exporting !== null}>
                  {!exporting && <Download className="w-3.5 h-3.5 mr-1 text-blue-500" />} CSV
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

