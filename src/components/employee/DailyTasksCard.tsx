'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { ClipboardList, CheckCircle2, Circle, Loader2, Lock } from 'lucide-react';

// ---------------------------------------------------------------------------
// Task definitions (Bengali labels + English keys)
// ---------------------------------------------------------------------------
const DAILY_TASKS = [
  { key: 'showroom_clean',   label: 'শোরুম পরিষ্কার করা ও ঝাড়ু দেওয়া' },
  { key: 'generator_oil',    label: 'জেনারেটরের তেল চেক করা' },
  { key: 'products_organized', label: 'শোরুমের সব পণ্য/কাপড় সুন্দরভাবে গোছানো' },
  { key: 'cash_office_table', label: 'ক্যাশ/অফিস টেবিল পরিষ্কার ও গোছানো' },
  { key: 'display_rack',     label: 'ডিসপ্লে র‍্যাক ও হ্যাঙ্গার ঠিকভাবে সাজানো' },
  { key: 'mirror_glass_door', label: 'আয়না, গ্লাস ও দরজা পরিষ্কার করা' },
  { key: 'light_fan_ac',     label: 'লাইট, ফ্যান ও AC চেক করা' },
  { key: 'cash_counter',     label: 'ক্যাশ কাউন্টার পরিষ্কার ও গোছানো' },
  { key: 'dustbin',          label: 'ডাস্টবিন পরিষ্কার করা' },
  { key: 'entrance_clean',   label: 'শোরুমের বাইরে প্রবেশপথ পরিষ্কার রাখা' },
];

// ---------------------------------------------------------------------------
// Types — new rich per-task JSONB structure
// ---------------------------------------------------------------------------
interface TaskEntry {
  status: 'completed' | 'pending';
  completed_by_id?: string;
  completed_by_name?: string;
  completed_at?: string; // ISO string
}

type TasksState = Record<string, TaskEntry>;

interface DailyTasksCardProps {
  branchId: string | null | undefined;
}

// ---------------------------------------------------------------------------
// Helper: format a UTC ISO timestamp to local Bangladesh time (HH:MM AM/PM)
// ---------------------------------------------------------------------------
function formatLocalTime(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Dhaka',
    });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DailyTasksCard({ branchId }: DailyTasksCardProps) {
  const supabase      = useMemo(() => createClient(), []);
  const [tasksState, setTasksState] = useState<TasksState>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState<string | null>(null); // key of task being saved
  const [currentUserId, setCurrentUserId]     = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  // Use local date to avoid UTC/Bangladesh tz mismatch
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const completedCount = DAILY_TASKS.filter(t => tasksState[t.key]?.status === 'completed').length;
  const totalCount     = DAILY_TASKS.length;
  const progressPct    = Math.round((completedCount / totalCount) * 100);

  // -------------------------------------------------------------------------
  // Load current user profile
  // -------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;
      setCurrentUserId(userId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (profile?.full_name) setCurrentUserName(profile.full_name);
    })();
  }, [supabase]);

  // -------------------------------------------------------------------------
  // Load today's tasks for the branch
  // -------------------------------------------------------------------------
  const loadTasks = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('showroom_daily_tasks')
      .select('tasks_state')
      .eq('branch_id', branchId)
      .eq('date', today)
      .maybeSingle();

    if (!error && data?.tasks_state) {
      setTasksState(data.tasks_state as TasksState);
    } else {
      setTasksState({});
    }

    setLoading(false);
  }, [branchId, today, supabase]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // -------------------------------------------------------------------------
  // Toggle a task via the race-condition-safe RPC
  // -------------------------------------------------------------------------
  const toggleTask = useCallback(async (key: string) => {
    if (!branchId || !currentUserId || !currentUserName) return;

    const entry = tasksState[key];

    // Prevent Employee A from unchecking a task completed by Employee B
    if (entry?.status === 'completed' && entry.completed_by_id !== currentUserId) {
      return; // silently blocked — button is disabled via UI too
    }

    // Optimistic update
    const optimisticEntry: TaskEntry = entry?.status === 'completed'
      ? { status: 'pending' }
      : {
          status: 'completed',
          completed_by_id:   currentUserId,
          completed_by_name: currentUserName,
          completed_at:      new Date().toISOString(),
        };

    setTasksState(prev => ({ ...prev, [key]: optimisticEntry }));
    setSaving(key);

    try {
      const { data, error } = await supabase.rpc('toggle_showroom_task', {
        p_branch_id:    branchId,
        p_task_key:     key,
        p_employee_id:  currentUserId,
        p_employee_name: currentUserName,
      });

      if (error) throw error;

      // Sync with the authoritative state returned by the server
      if (data) setTasksState(data as TasksState);
    } catch {
      // Revert optimistic update on failure
      setTasksState(prev => ({ ...prev, [key]: entry ?? { status: 'pending' } }));
    } finally {
      setSaving(null);
    }
  }, [branchId, currentUserId, currentUserName, tasksState, supabase]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!branchId) return null;

  return (
    <Card className="bg-white border-slate-200 col-span-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1dbf73]/10 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-[#1dbf73]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              🏬 Showroom Daily Tasks
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-slate-700">
            {completedCount}/{totalCount}
          </span>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500 ${
              progressPct === 100
                ? 'border-[#1dbf73] bg-[#1dbf73]/10 text-[#1dbf73]'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {progressPct}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-2 mb-5 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPct}%`,
            background: progressPct === 100
              ? '#1dbf73'
              : 'linear-gradient(90deg, #1dbf73, #0ea5e9)',
          }}
        />
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">লোড হচ্ছে...</span>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DAILY_TASKS.map((task, idx) => {
            const entry     = tasksState[task.key];
            const isCompleted = entry?.status === 'completed';
            const isSaving  = saving === task.key;

            // A task is locked (can't be unticked) if completed by a DIFFERENT employee
            const isLockedByOther = isCompleted && entry.completed_by_id !== currentUserId;

            return (
              <li key={task.key}>
                <button
                  id={`daily-task-${task.key}`}
                  onClick={() => toggleTask(task.key)}
                  disabled={isSaving || isLockedByOther}
                  title={
                    isLockedByOther
                      ? `${entry.completed_by_name} এই কাজটি সম্পন্ন করেছেন`
                      : undefined
                  }
                  className={`
                    w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left
                    transition-all duration-200 group
                    ${isCompleted
                      ? 'bg-[#1dbf73]/8 border-[#1dbf73]/30'
                      : 'bg-slate-50 border-slate-200 hover:border-[#1dbf73]/40 hover:bg-slate-100'
                    }
                    ${isLockedByOther ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}
                    ${isSaving ? 'opacity-60 cursor-wait' : ''}
                  `}
                >
                  {/* Checkbox icon */}
                  <span className="shrink-0 mt-0.5">
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 text-[#1dbf73] animate-spin" />
                    ) : isLockedByOther ? (
                      <Lock className="w-5 h-5 text-[#1dbf73]/60" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-[#1dbf73] drop-shadow-sm" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 group-hover:text-[#1dbf73]/60 transition-colors" />
                    )}
                  </span>

                  {/* Task number + label + attribution */}
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xs font-bold shrink-0 ${isCompleted ? 'text-[#1dbf73]' : 'text-slate-400'}`}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-sm font-medium leading-snug transition-all duration-200 ${
                          isCompleted
                            ? 'text-slate-400 line-through decoration-[#1dbf73]/50'
                            : 'text-slate-700 group-hover:text-slate-900'
                        }`}
                      >
                        {task.label}
                      </span>
                    </div>

                    {/* Attribution: who completed + at what time */}
                    {isCompleted && entry.completed_by_name && (
                      <p className="text-xs text-[#1dbf73]/80 font-medium pl-5 leading-tight">
                        ✓ {entry.completed_by_name}
                        {entry.completed_at ? ` — ${formatLocalTime(entry.completed_at)}` : ''}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Completion banner */}
      {!loading && progressPct === 100 && (
        <div className="mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1dbf73]/10 border border-[#1dbf73]/25 animate-fade-in">
          <span className="text-lg">🎉</span>
          <p className="text-sm font-bold text-[#1dbf73]">
            সব কাজ সম্পন্ন! Showroom is fully prepared for the day.
          </p>
        </div>
      )}
    </Card>
  );
}
