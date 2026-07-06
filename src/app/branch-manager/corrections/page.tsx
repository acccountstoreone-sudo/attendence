'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import {
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Calendar,
  User,
  Search,
} from 'lucide-react';

interface CorrectionRequest {
  id: string;
  user_id: string;
  employee_name: string;
  date: string;
  type: 'check_in' | 'check_out';
  original_time?: string;
  requested_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function ManualCorrectionsPage() {
  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [reviewModal, setReviewModal] = useState<CorrectionRequest | null>(null);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const loadCorrections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/manual-correction');
      const json = await res.json();
      if (json.success) setCorrections(json.data || []);
    } catch (err) {
      console.error('Load corrections error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCorrections(); }, []);

  const handleReview = async (id: string, action: 'approved' | 'rejected', reviewNote?: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/attendance/manual-correction/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, review_note: reviewNote || '' }),
      });
      if (res.ok) {
        setReviewModal(null);
        await loadCorrections();
      }
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const filtered = corrections.filter((c) => {
    const matchSearch = c.employee_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filter === 'all' || c.status === filter;
    return matchSearch && matchStatus;
  });

  const pendingCount = corrections.filter((c) => c.status === 'pending').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 p-6 rounded-3xl border border-amber-500/20 shadow-2xl">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Supervisor Action Required</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-600 text-white text-xs font-extrabold rounded-full animate-pulse">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">Manual Attendance Corrections</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and authorize staff requests for attendance timestamp adjustments.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search staff name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg transition-all capitalize ${filter === s ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Corrections List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" label="Loading Correction Requests..." />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-16 text-center border-slate-800 border-dashed">
          <UserCheck className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">
            {filter === 'pending' ? 'No Pending Requests — You\'re All Caught Up!' : `No ${filter} correction requests.`}
          </h3>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <Card key={req.id} variant="elevated" className={`border-l-4 ${req.status === 'pending' ? 'border-l-amber-500' : req.status === 'approved' ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-2xl shrink-0 ${req.status === 'pending' ? 'bg-amber-950/80 text-amber-400' : req.status === 'approved' ? 'bg-emerald-950/80 text-emerald-400' : 'bg-rose-950/80 text-rose-400'}`}>
                    <Clock className="w-6 h-6" />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-bold text-white text-sm">{req.employee_name}</h4>
                      <Badge
                        status={req.status === 'pending' ? 'late' : req.status === 'approved' ? 'present' : 'absent'}
                        variant="subtle"
                      >
                        {req.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span><strong className="text-slate-300">{req.date}</strong> — Correction Type: <strong className="text-amber-400 capitalize">{req.type.replace('_', ' ')}</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span>Original: <strong className="text-slate-300">{req.original_time || '—'}</strong> → Requested: <strong className="text-blue-400">{req.requested_time}</strong></span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <User className="w-3.5 h-3.5 shrink-0 text-slate-500 mt-0.5" />
                        <span>Reason: <span className="text-slate-300 italic">&quot;{req.reason}&quot;</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex items-center space-x-2 shrink-0">
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<X className="w-4 h-4" />}
                      onClick={() => handleReview(req.id, 'rejected')}
                      isLoading={processing}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => handleReview(req.id, 'approved')}
                      isLoading={processing}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Detail Modal */}
      {reviewModal && (
        <Modal
          isOpen={!!reviewModal}
          onClose={() => setReviewModal(null)}
          title="Review Correction Request"
          description="Carefully review the employee's justification before authorizing this attendance amendment."
        >
          <div className="space-y-3 text-sm text-slate-300">
            <p><strong>Employee:</strong> {reviewModal.employee_name}</p>
            <p><strong>Date:</strong> {reviewModal.date}</p>
            <p><strong>Correction Type:</strong> {reviewModal.type.replace('_', ' ')}</p>
            <p><strong>Requested Time:</strong> {reviewModal.requested_time}</p>
            <p className="italic bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <strong>Reason:</strong> &quot;{reviewModal.reason}&quot;
            </p>
            <div className="flex space-x-3 pt-2">
              <Button variant="danger" className="flex-1" onClick={() => handleReview(reviewModal.id, 'rejected')} isLoading={processing}>Reject</Button>
              <Button variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={() => handleReview(reviewModal.id, 'approved')} isLoading={processing}>Approve</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
