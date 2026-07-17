'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar, Filter, Download, User, MapPin } from 'lucide-react';
import { Branch } from './types';

interface BranchAttendanceTabProps {
  branch: Branch;
}

export const BranchAttendanceTab: React.FC<BranchAttendanceTabProps> = ({ branch }) => {
  const router = useRouter();
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    async function fetchAttendance() {
      setLoading(true);
      try {
        const url = `/api/attendance/history?branch_id=${branch.id}&limit=100${view === 'daily' ? `&date=${selectedDate}` : `&month=${selectedMonth}&year=${selectedYear}`}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setRecords(json.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [branch.id, view, selectedDate, selectedMonth, selectedYear]);

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '--:--';
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleExport = () => {
    // The export API supports branch_id, month and year
    const url = `/api/reports/export?branch_id=${branch.id}&format=pdf&month=${selectedMonth}&year=${selectedYear}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h4 className="text-lg font-bold text-slate-900">Attendance Records</h4>
        <div className="flex items-center space-x-2">
          <div className="bg-white rounded-lg p-1 border border-slate-200 flex">
            <button 
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'daily' ? 'bg-slate-50 text-slate-900' : 'text-slate-900 hover:text-slate-900'}`}
              onClick={() => setView('daily')}
            >
              Daily
            </button>
            <button 
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'monthly' ? 'bg-slate-50 text-slate-900' : 'text-slate-900 hover:text-slate-900'}`}
              onClick={() => setView('monthly')}
            >
              Monthly
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {showFilter && (
        <Card className="p-4 bg-white border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {view === 'daily' ? (
              <div className="flex flex-col space-y-1 w-full sm:w-auto">
                <label className="text-xs font-semibold text-slate-500">Select Date</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#1dbf73]"
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col space-y-1 w-full sm:w-auto">
                  <label className="text-xs font-semibold text-slate-500">Select Month</label>
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#1dbf73]"
                  >
                    {Array.from({length: 12}).map((_, i) => (
                      <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col space-y-1 w-full sm:w-auto">
                  <label className="text-xs font-semibold text-slate-500">Select Year</label>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#1dbf73]"
                  >
                    {[2024, 2025, 2026, 2027, 2028, 2029].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      <Card className="bg-white border-slate-200 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
           <h5 className="text-sm font-semibold text-slate-900">
             {view === 'daily' 
               ? (selectedDate === new Date().toISOString().split('T')[0] ? 'Today\'s Attendance' : `Attendance for ${selectedDate}`)
               : `Attendance for ${new Date(0, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear}`}
           </h5>
           <span className="text-xs text-slate-500 flex items-center"><Calendar className="w-3 h-3 mr-1"/> {view === 'daily' ? selectedDate : `${selectedMonth}/${selectedYear}`}</span>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1dbf73]"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
             <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
             <p className="text-sm font-medium">No attendance records found.</p>
             <p className="text-xs mt-1">Data will appear here once employees check in.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white text-slate-900 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Employee</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Date</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Time In/Out</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Location</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => router.push(`/admin/attendance?search=${encodeURIComponent(record.profiles?.full_name || '')}&tab=all`)}
                    className="hover:bg-[#1dbf73]/5 hover:scale-[1.002] transition-all cursor-pointer group"
                    title={`Click to view full attendance history for ${record.profiles?.full_name || 'Unknown'}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-[#1dbf73]/10 transition-colors">
                          <User className="w-4 h-4 text-slate-500 group-hover:text-[#1dbf73] transition-colors" />
                        </div>
                        <div className="font-bold text-slate-900 group-hover:text-[#1dbf73] transition-colors">{record.profiles?.full_name || 'Unknown'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900">
                      {new Date(record.check_in_time).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-medium">{formatTime(record.check_in_time)}</div>
                      <div className="text-xs text-slate-500 mt-1">{formatTime(record.check_out_time)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
                        record.status === 'present' ? 'bg-[#1dbf73]/10 text-[#1dbf73]' :
                        record.status === 'late' ? 'bg-orange-500/10 text-orange-500' :
                        record.status === 'half-day' ? 'bg-yellow-500/10 text-yellow-600' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 flex items-center mt-2">
                       {record.location ? <><MapPin className="w-3 h-3 mr-1"/> {record.location.split(',').slice(0,2).join(',')}</> : '-'}
                    </td>
                    <td className="px-6 py-4">
                       <div className="text-slate-900 font-medium">
                          {(() => {
                            const mins = record.working_minutes || (record.check_in_time && record.check_out_time ? Math.round((new Date(record.check_out_time).getTime() - new Date(record.check_in_time).getTime()) / 60000) : 0);
                            return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                          })()}
                       </div>
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

