'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Branch } from '@/components/admin/branch/types';
import { createClient } from '@/lib/supabase/client';
import { Calendar, CheckCircle2, Circle, Search, Filter } from 'lucide-react';

interface BranchTasksTabProps {
  branch: Branch;
}

interface TaskLog {
  id: string;
  date: string;
  task_key: string;
  employee_id: string;
  employee_name: string;
  action: 'completed' | 'uncompleted';
  created_at: string;
}

const DAILY_TASKS = [
  { key: 'showroom_clean', label: 'শোরুম পরিষ্কার করা ও ঝাড়ু দেওয়া' },
  { key: 'generator_oil', label: 'জেনারেটরের তেল চেক করা' },
  { key: 'products_organized', label: 'শোরুমের সব পণ্য/কাপড় সুন্দরভাবে গোছানো' },
  { key: 'cash_office_table', label: 'ক্যাশ/অফিস টেবিল পরিষ্কার ও গোছানো' },
  { key: 'display_rack', label: 'ডিসপ্লে র‍্যাক ও হ্যাঙ্গার ঠিকভাবে সাজানো' },
  { key: 'mirror_glass_door', label: 'আয়না, গ্লাস ও দরজা পরিষ্কার করা' },
  { key: 'light_fan_ac', label: 'লাইট, ফ্যান ও AC চেক করা' },
  { key: 'cash_counter', label: 'ক্যাশ কাউন্টার পরিষ্কার ও গোছানো' },
  { key: 'dustbin', label: 'ডাস্টবিন পরিষ্কার করা' },
  { key: 'entrance_clean', label: 'শোরুমের বাইরে প্রবেশপথ পরিষ্কার রাখা' },
];

export function BranchTasksTab({ branch }: BranchTasksTabProps) {
  const supabase = useMemo(() => createClient(), []);
  
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Month Selection
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  useEffect(() => {
    async function fetchTaskHistory() {
      setLoading(true);
      try {
        // Calculate start and end dates for the selected month
        const startDate = new Date(selectedYear, selectedMonth - 1, 1);
        const endDate = new Date(selectedYear, selectedMonth, 0); // Last day of month
        
        // Format to YYYY-MM-DD
        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
        const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

        const { data, error } = await supabase
          .from('showroom_task_logs')
          .select('*')
          .eq('branch_id', branch.id)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        setLogs(data || []);
      } catch (err) {
        console.error('Failed to fetch task history:', err);
      } finally {
        setLoading(false);
      }
    }

    if (branch?.id) {
      fetchTaskHistory();
    }
  }, [branch?.id, selectedMonth, selectedYear, supabase]);

  // We only care about the latest status of each task per day.
  // The log has both 'completed' and 'uncompleted'.
  // We'll reduce it to find the final state for each day-task combo.
  const processedData = useMemo(() => {
    const finalStates: Record<string, TaskLog> = {};

    logs.forEach(log => {
      const key = `${log.date}_${log.task_key}`;
      // Since logs are sorted by created_at DESC, the first one we see is the final state.
      if (!finalStates[key]) {
        finalStates[key] = log;
      }
    });

    // Group by Date
    const groupedByDate: Record<string, TaskLog[]> = {};
    Object.values(finalStates).forEach(log => {
      // Only include if the final state is 'completed'
      if (log.action === 'completed') {
        if (!groupedByDate[log.date]) {
          groupedByDate[log.date] = [];
        }
        groupedByDate[log.date].push(log);
      }
    });

    // Return an array sorted by date descending
    return Object.entries(groupedByDate).sort(([dateA], [dateB]) => {
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Daily Task History</h2>
          <p className="text-sm text-slate-500 mt-1">See which employee completed which task on a given day.</p>
        </div>

        <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-500 ml-2" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'short' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
          >
            {[now.getFullYear(), now.getFullYear() - 1].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner size="lg" label="Loading task history..." />
        </div>
      ) : processedData.length === 0 ? (
        <Card className="bg-slate-50 border-dashed border-2 p-12 text-center flex flex-col items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Tasks Completed</h3>
          <p className="text-slate-500">There are no completed tasks recorded for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {processedData.map(([date, dayLogs]) => (
            <Card key={date} className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">
                  {new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                </h3>
                <span className="text-xs font-bold bg-[#1dbf73]/10 text-[#1dbf73] px-2 py-1 rounded-md">
                  {dayLogs.length}/{DAILY_TASKS.length} Tasks
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {dayLogs.map(log => {
                  const taskDef = DAILY_TASKS.find(t => t.key === log.task_key);
                  return (
                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#1dbf73] shrink-0" />
                        <div>
                          <p className="font-medium text-slate-800 text-sm">
                            {taskDef?.label || log.task_key}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Completed at {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {log.employee_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{log.employee_name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
