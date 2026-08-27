'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Branch } from '@/components/admin/branch/types';
import { createClient } from '@/lib/supabase/client';
import { Calendar, CheckCircle2, History, Settings, Plus, Power, Trash2 } from 'lucide-react';

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

interface BranchTask {
  id: string;
  branch_id: string;
  task_key: string;
  label: string;
  is_active: boolean;
}

export function BranchTasksTab({ branch }: BranchTasksTabProps) {
  const supabase = useMemo(() => createClient(), []);
  
  const [activeTab, setActiveTab] = useState<'history' | 'manage'>('history');
  
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [branchTasks, setBranchTasks] = useState<BranchTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  
  // Month Selection
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const fetchData = async () => {
    if (!branch?.id) return;
    setLoading(true);
    try {
      // 1. Fetch branch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('branch_tasks')
        .select('*')
        .eq('branch_id', branch.id)
        .order('created_at', { ascending: true });
        
      if (tasksError) throw tasksError;
      setBranchTasks(tasksData || []);

      // 2. Fetch history logs
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      
      const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const { data: logsData, error: logsError } = await supabase
        .from('showroom_task_logs')
        .select('*')
        .eq('branch_id', branch.id)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;
      setLogs(logsData || []);
    } catch (err) {
      console.error('Failed to fetch task data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branch?.id, selectedMonth, selectedYear, supabase]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskLabel.trim()) return;
    
    setIsAddingTask(true);
    try {
      // Generate a task key (alphanumeric, lowercase, underscores)
      const taskKey = 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5);
      
      const { error } = await supabase
        .from('branch_tasks')
        .insert({
          branch_id: branch.id,
          task_key: taskKey,
          label: newTaskLabel.trim(),
          is_active: true
        });
        
      if (error) throw error;
      setNewTaskLabel('');
      await fetchData();
    } catch (err) {
      console.error('Error adding task:', err);
      alert('Failed to add task.');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('branch_tasks')
        .update({ is_active: !currentStatus })
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Optimistic update
      setBranchTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_active: !currentStatus } : t));
    } catch (err) {
      console.error('Error toggling task:', err);
      alert('Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task completely? It is recommended to just disable it if it has historical logs.')) return;
    
    try {
      const { error } = await supabase
        .from('branch_tasks')
        .delete()
        .eq('id', taskId);
        
      if (error) throw error;
      setBranchTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task.');
    }
  };

  // Process history data
  const processedData = useMemo(() => {
    const finalStates: Record<string, TaskLog> = {};

    logs.forEach(log => {
      const key = `${log.date}_${log.task_key}`;
      if (!finalStates[key]) {
        finalStates[key] = log;
      }
    });

    const groupedByDate: Record<string, TaskLog[]> = {};
    Object.values(finalStates).forEach(log => {
      if (log.action === 'completed') {
        if (!groupedByDate[log.date]) {
          groupedByDate[log.date] = [];
        }
        groupedByDate[log.date].push(log);
      }
    });

    return Object.entries(groupedByDate).sort(([dateA], [dateB]) => {
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'history' 
              ? 'border-[#1dbf73] text-[#1dbf73]' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          Task History
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'manage' 
              ? 'border-[#1dbf73] text-[#1dbf73]' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          Manage Branch Tasks
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner size="lg" label="Loading tasks..." />
        </div>
      ) : activeTab === 'manage' ? (
        // MANAGE TASKS TAB
        <div className="space-y-6">
          <Card className="bg-white border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#1dbf73]" />
              Add New Daily Task
            </h3>
            <form onSubmit={handleAddTask} className="flex gap-3">
              <input
                type="text"
                placeholder="Enter task name (e.g., Clean the glass door)"
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-2 focus:ring-[#1dbf73]/20 transition-all placeholder:text-slate-400"
                required
              />
              <Button type="submit" disabled={isAddingTask} className="bg-[#1dbf73] hover:bg-[#16965a] text-white whitespace-nowrap rounded-xl px-5 h-auto font-medium shadow-sm shadow-[#1dbf73]/20">
                {isAddingTask ? <Spinner size="sm" /> : 'Add Task'}
              </Button>
            </form>
          </Card>

          <Card className="bg-white border-slate-200 overflow-hidden">
            <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Active Daily Tasks ({branchTasks.filter(t => t.is_active).length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {branchTasks.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center bg-slate-50/50">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 border border-slate-200">
                    <Settings className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">No tasks configured</p>
                  <p className="text-sm text-slate-400 mt-1">Add a new daily task above to get started.</p>
                </div>
              ) : (
                branchTasks.map(task => (
                  <div key={task.id} className={`p-4 flex items-center justify-between transition-colors ${task.is_active ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-2 h-2 rounded-full ${task.is_active ? 'bg-[#1dbf73]' : 'bg-slate-300'}`} />
                      <span className={`font-medium text-sm ${task.is_active ? 'text-slate-800' : 'text-slate-500 line-through'}`}>
                        {task.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleToggleTask(task.id, task.is_active)}
                        className={`px-3 py-1 text-xs gap-1.5 ${task.is_active ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-[#1dbf73] border-[#1dbf73]/30 hover:bg-[#1dbf73]/10'}`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {task.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      {!task.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : (
        // HISTORY TAB
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Task Completion History</h2>
            </div>
            <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
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

          {processedData.length === 0 ? (
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
                    <span className="text-xs font-bold bg-[#1dbf73]/10 text-[#1dbf73] px-2 py-1 rounded-md border border-[#1dbf73]/20">
                      {dayLogs.length} Tasks Completed
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dayLogs.map(log => {
                      const taskDef = branchTasks.find(t => t.task_key === log.task_key);
                      const isDeleted = !taskDef;
                      
                      return (
                        <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className={`w-5 h-5 shrink-0 ${isDeleted ? 'text-slate-400' : 'text-[#1dbf73]'}`} />
                            <div>
                              <p className={`font-medium text-sm flex items-center gap-2 ${isDeleted ? 'text-slate-500 italic' : 'text-slate-800'}`}>
                                {taskDef?.label || `Deleted Task (${log.task_key.split('_')[1] || log.task_key})`}
                                {isDeleted && <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Deleted</span>}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Completed at {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-blue-200">
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
      )}
    </div>
  );
}
