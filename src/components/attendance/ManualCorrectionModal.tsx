'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { X, AlertCircle, Trash2, Sparkles, Edit3 } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  approval_status?: string;
  override_reason?: string | null;
  approval_note?: string | null;
  full_name?: string;
  employee_id?: string;
  profiles?: { full_name?: string; employee_id?: string };
}

interface ManualCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSuccess: (message?: string) => void;
  allowDelete?: boolean;
}

const EDIT_REASON_PRESETS = [
  'App issue — corrected shift timing',
  'Employee forgot to check out',
  'Approved present by management',
  'Corrected attendance status for payroll',
];

function formatForDhakaInput(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  // Format explicitly in Asia/Dhaka so edits are consistent regardless of browser timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

function dhakaInputToIso(localDateTimeStr: string): string | null {
  if (!localDateTimeStr) return null;
  // Treat the datetime-local input explicitly as Asia/Dhaka (+06:00)
  return new Date(`${localDateTimeStr}:00+06:00`).toISOString();
}

export const ManualCorrectionModal: React.FC<ManualCorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
  allowDelete = false,
}) => {
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [status, setStatus] = useState('present');
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (record && isOpen) {
      setCheckInTime(formatForDhakaInput(record.check_in_time));
      setCheckOutTime(formatForDhakaInput(record.check_out_time));
      const normalizedStatus = ['present', 'late', 'half_day', 'absent'].includes(record.status)
        ? record.status
        : 'present';
      setStatus(normalizedStatus);
      setApprovalStatus(
        record.approval_status === 'pending' || record.approval_status === 'rejected'
          ? 'approved' // Default to approving when an admin manually edits
          : 'approved'
      );
      setReason('');
      setError('');
      setConfirmDelete(false);
    }
  }, [record, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    if (reason.trim().length < 3) {
      setError('Reason must be at least 3 characters long.');
      return;
    }
    if (!checkInTime) {
      setError('Check-in time is required.');
      return;
    }
    const checkInIso = dhakaInputToIso(checkInTime);
    const checkOutIso = dhakaInputToIso(checkOutTime);
    if (!checkInIso) {
      setError('Invalid check-in time.');
      return;
    }
    if (checkOutIso && new Date(checkOutIso) <= new Date(checkInIso)) {
      setError('Check-out time must be after check-in time.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/attendance/manual-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'edit',
          record_id: record.id,
          check_in_time: checkInIso,
          check_out_time: checkOutIso,
          status,
          approval_status: approvalStatus,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || 'Failed to apply manual correction.');
      }

      onSuccess(json.message);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    setIsDeleting(true);
    setError('');
    try {
      const res = await fetch(
        `/api/attendance/manual-correction?record_id=${encodeURIComponent(record.id)}&reason=${encodeURIComponent(reason.trim() || 'Removed by Admin')}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || 'Failed to delete attendance record.');
      }
      onSuccess('Attendance record deleted successfully.');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !record) return null;

  const empName = record.full_name || record.profiles?.full_name || 'Unknown Employee';
  const priorNote = record.override_reason || record.approval_note;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200/60 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Edit Attendance Record</h3>
              <p className="text-sm text-slate-500 mt-0.5">Manually editing for {empName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
            disabled={isSubmitting || isDeleting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-200 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {priorNote && (
            <div className="p-3 bg-purple-50 border border-purple-200/70 rounded-xl text-xs text-purple-900">
              <span className="font-bold uppercase tracking-wider text-[10px] text-purple-700 block mb-0.5">
                Previous Note / Override Reason
              </span>
              {priorNote}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                Check-In Time (BD Time) *
              </label>
              <input
                type="datetime-local"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                required
                disabled={isSubmitting || isDeleting}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Check-Out Time (BD Time)
                </label>
                {checkOutTime && (
                  <button
                    type="button"
                    onClick={() => setCheckOutTime('')}
                    className="text-[11px] font-bold text-rose-500 hover:underline"
                    disabled={isSubmitting || isDeleting}
                  >
                    Clear Check-Out
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                disabled={isSubmitting || isDeleting}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Attendance Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isSubmitting || isDeleting}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Approval Status
                </label>
                <select
                  value={approvalStatus}
                  onChange={(e) => setApprovalStatus(e.target.value as 'approved' | 'pending' | 'rejected')}
                  disabled={isSubmitting || isDeleting}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all"
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                Reason for Edit *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EDIT_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    disabled={isSubmitting || isDeleting}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#1dbf73]/15 hover:text-[#16965a] text-slate-700 text-[11px] font-medium transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for audit logging (min 3 chars)..."
                required
                minLength={3}
                rows={3}
                disabled={isSubmitting || isDeleting}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-[#1dbf73] focus:ring-1 focus:ring-[#1dbf73] transition-all resize-none"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200/80">
            {allowDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={handleDelete}
                    isLoading={isDeleting}
                    disabled={isSubmitting || isDeleting}
                    className="text-xs font-bold"
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                    className="text-xs"
                  >
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isSubmitting || isDeleting}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold self-start sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete Record
                </Button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="bg-[#1dbf73] hover:bg-[#16965a] text-white font-bold"
                disabled={isSubmitting || isDeleting}
                isLoading={isSubmitting}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
