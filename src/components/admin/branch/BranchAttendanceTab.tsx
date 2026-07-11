'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar, Filter, Download } from 'lucide-react';

export const BranchAttendanceTab: React.FC = () => {
  const [view, setView] = useState<'daily' | 'monthly'>('daily');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h4 className="text-lg font-bold text-slate-900">Attendance Records</h4>
        <div className="flex items-center space-x-2">
          <div className="bg-white rounded-lg p-1 border border-slate-200 flex">
            <button 
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'daily' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => setView('daily')}
            >
              Daily
            </button>
            <button 
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'monthly' ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => setView('monthly')}
            >
              Monthly
            </button>
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <Card className="bg-white border-slate-200 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
           <h5 className="text-sm font-semibold text-slate-600">
             {view === 'daily' ? 'Today\'s Attendance' : 'This Month\'s Attendance'}
           </h5>
           <span className="text-xs text-slate-500 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {new Date().toLocaleDateString()}</span>
        </div>
        <div className="p-12 text-center text-slate-500">
           <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
           <p className="text-sm font-medium">No attendance records found.</p>
           <p className="text-xs mt-1">Data will appear here once employees check in.</p>
        </div>
      </Card>
    </div>
  );
};

