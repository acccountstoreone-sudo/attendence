'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Clock, Calendar, X, AlertCircle, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OvertimeRecord {
  id: string;
  check_in_time?: string;
  check_out_time?: string;
  overtime_minutes?: number;
  approved_overtime_minutes?: number;
  overtime_approval_status?: string;
  is_holiday_duty?: boolean;
}

export default function EmployeeOvertimePage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Request Overtime Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reqDate, setReqDate] = useState('');
  const [reqInTime, setReqInTime] = useState('');
  const [reqOutTime, setReqOutTime] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchOvertimeRecords();
  }, [supabase]);

  const fetchOvertimeRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error('User not authenticated');
      setUserId(userData.user.id);

      const { data, error: fetchErr } = await supabase
        .from('attendance_records')
        .select('id, check_in_time, check_out_time, overtime_minutes, approved_overtime_minutes, overtime_approval_status, is_holiday_duty')
        .eq('employee_id', userData.user.id)
        .or('overtime_minutes.gt.0,approved_overtime_minutes.gt.0,is_holiday_duty.eq.true')
        .order('check_in_time', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);

      setRecords(data || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching overtime data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!reqDate || !reqInTime || !reqOutTime || !reqReason) {
      setFormError('Please fill out all fields.');
      return;
    }

    const selectedDate = new Date(reqDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setFormError('Request for previous day is not allowed.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/attendance/request-overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: reqDate,
          check_in_time: reqInTime,
          check_out_time: reqOutTime,
          reason: reqReason,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to submit request');
      }

      alert('Overtime request submitted successfully!');
      setIsModalOpen(false);
      setReqDate('');
      setReqInTime('');
      setReqOutTime('');
      setReqReason('');
      fetchOvertimeRecords();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMinutes = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours > 0) return `${hours}h ${m}m`;
    return `${m}m`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800';
      case 'rejected': return 'bg-rose-100 text-rose-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'auto': return 'bg-emerald-100 text-emerald-800'; // Default auto-calculation
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Overtime</h1>
          <p className="text-slate-600 mt-1">View your logged overtime hours and requests.</p>
        </div>
        <Button 
          variant="primary" 
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          Request Off-Day Overtime
        </Button>
      </div>

      <Card className="p-6 overflow-x-auto">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
            <h3 className="text-lg font-semibold text-rose-900 mb-1">Failed to Load Overtime Data</h3>
            <p className="text-rose-600">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchOvertimeRecords}>Try Again</Button>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center text-slate-500">
            <Clock className="w-12 h-12 mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No Overtime Records</h3>
            <p>You haven't logged any overtime yet.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 text-sm font-medium text-slate-500">Date</th>
                <th className="pb-3 text-sm font-medium text-slate-500">Check In</th>
                <th className="pb-3 text-sm font-medium text-slate-500">Check Out</th>
                <th className="pb-3 text-sm font-medium text-slate-500">Logged OT</th>
                <th className="pb-3 text-sm font-medium text-slate-500">Approved OT</th>
                <th className="pb-3 text-sm font-medium text-slate-500">Status</th>
                <th className="pb-3 text-sm font-medium text-slate-500">Type</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const logged = r.overtime_minutes || 0;
                
                // Determine true approval status
                // The database trigger incorrectly overwrites overtime_approval_status on every update.
                let trueStatus = r.overtime_approval_status || 'auto';
                if (r.approved_overtime_minutes !== null && r.approved_overtime_minutes !== undefined) {
                  // A manager has taken action
                  if (r.approved_overtime_minutes === 0 && logged > 0) {
                    trueStatus = 'rejected';
                  } else {
                    trueStatus = 'approved';
                  }
                } else if (r.is_holiday_duty) {
                  // Unactioned holiday duty
                  trueStatus = 'pending';
                }
                
                const approved = r.approved_overtime_minutes !== null && r.approved_overtime_minutes !== undefined 
                  ? r.approved_overtime_minutes 
                  : (trueStatus === 'rejected' ? 0 : (trueStatus === 'pending' ? 0 : logged));

                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-medium text-slate-900">{r.check_in_time ? new Date(r.check_in_time).toLocaleDateString() : 'N/A'}</td>
                    <td className="py-4 text-slate-600">{formatTime(r.check_in_time)}</td>
                    <td className="py-4 text-slate-600">{formatTime(r.check_out_time)}</td>
                    <td className="py-4 font-medium text-indigo-600">{formatMinutes(logged)}</td>
                    <td className="py-4 font-medium text-emerald-600">{formatMinutes(approved)}</td>
                    <td className="py-4">
                      <Badge className={getStatusColor(trueStatus)}>
                        {trueStatus.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-4">
                      {r.is_holiday_duty ? (
                        <Badge className="bg-purple-100 text-purple-800">Off-Day</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-800">Regular Shift</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Request Overtime Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Request Off-Day Overtime</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start text-rose-700">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">{formError}</span>
                </div>
              )}
              <form onSubmit={handleRequestOvertime} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duty Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={reqDate}
                      onChange={(e) => setReqDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]} // Cannot request future overtime
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Select the off-day/holiday you worked.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={reqInTime}
                      onChange={(e) => setReqInTime(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={reqOutTime}
                      onChange={(e) => setReqOutTime(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                  <textarea
                    required
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Briefly explain what you worked on..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[100px] resize-y"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    isLoading={submitting}
                  >
                    Submit Request
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
