'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { X, AlertCircle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  full_name?: string;
  employee_id?: string;
  profiles?: { full_name?: string; employee_id?: string };
}

interface ManualCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSuccess: () => void;
}

export const ManualCorrectionModal: React.FC<ManualCorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [status, setStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (record && isOpen) {
      // Format time for datetime-local input (YYYY-MM-DDThh:mm)
      const formatForInput = (isoString: string | null) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        // Extract local time components to match datetime-local format
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setCheckInTime(formatForInput(record.check_in_time));
      setCheckOutTime(formatForInput(record.check_out_time));
      setStatus(record.status || 'present');
      setReason('');
      setError('');
    }
  }, [record, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    if (reason.length < 5) {
      setError('Reason must be at least 5 characters long.');
      return;
    }
    if (!checkInTime) {
      setError('Check-in time is required.');
      return;
    }
    if (checkOutTime && new Date(checkOutTime) <= new Date(checkInTime)) {
      setError('Check-out time must be after check-in time.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Convert back to ISO string keeping the local time intent
      const toIsoStr = (localDateTimeStr: string) => {
        if (!localDateTimeStr) return null;
        return new Date(localDateTimeStr).toISOString();
      };

      const res = await fetch('/api/attendance/manual-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: record.id,
          check_in_time: toIsoStr(checkInTime),
          check_out_time: toIsoStr(checkOutTime),
          status,
          reason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to apply manual correction.');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !record) return null;

  const empName = record.full_name || record.profiles?.full_name || 'Unknown Employee';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-200/60 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Manual Attendance Correction</h3>
            <p className="text-sm text-slate-500 mt-0.5">Editing record for {empName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Check-in Time</label>
              <input
                type="datetime-local"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Check-out Time</label>
              <input
                type="datetime-local"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Attendance Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all capitalize"
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Reason for Correction</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for audit logging (min 5 chars)..."
                required
                minLength={5}
                rows={3}
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all resize-none"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/80">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-[#1dbf73] hover:bg-[#16965a] text-white"
              disabled={isSubmitting}
              isLoading={isSubmitting}
            >
              Save Correction
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
