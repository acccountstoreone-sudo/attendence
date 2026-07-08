import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar, Filter, Download } from 'lucide-react';

export const BranchAttendanceTab: React.FC = () => {
  const [view, setView] = useState<'daily' | 'monthly'>('daily');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h4 className="text-lg font-bold text-white">Attendance Records</h4>
        <div className="flex items-center space-x-2">
          <div className="bg-slate-900 rounded-lg p-1 border border-slate-800 flex">
            <button 
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'daily' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setView('daily')}
            >
              Daily
            </button>
            <button 
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'monthly' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
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

      <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
           <h5 className="text-sm font-semibold text-slate-300">
             {view === 'daily' ? 'Today\'s Attendance (Placeholder)' : 'This Month\'s Attendance (Placeholder)'}
           </h5>
           <span className="text-xs text-slate-500 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {new Date().toLocaleDateString()}</span>
        </div>
        <div className="p-12 text-center text-slate-500">
           <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
           <p className="text-sm font-medium">Attendance records will be displayed here.</p>
           <p className="text-xs mt-1">This is a placeholder for the {view} view.</p>
        </div>
      </Card>
    </div>
  );
};
