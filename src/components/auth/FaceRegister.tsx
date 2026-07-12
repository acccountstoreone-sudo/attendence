'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ScanFace, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { FaceCapture } from '@/components/attendance/FaceCapture';
import { motion, AnimatePresence } from 'framer-motion';

export function FaceRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleFaceCapture = async (image: string, descriptor: number[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/employees/enroll-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceDescriptor: descriptor, selfieUrl: image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to enroll face.');
      setSuccess(true);
      setShowModal(false);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message || 'An unexpected error occurred during face setup.');
      } else {
        setError('An unexpected error occurred during face setup.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3 text-sm text-slate-600">
        <ScanFace className="w-5 h-5 text-indigo-400" />
        <div>
          <p className="font-medium text-slate-700">Face Verification</p>
          <p className="text-xs text-slate-600">Enroll your face to check in without a fingerprint.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start space-x-2 p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="flex items-center space-x-2 p-3 rounded bg-[#1dbf73]/10 border border-emerald-500/20 text-[#1dbf73] text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Face successfully enrolled!</span>
        </div>
      ) : (
        <Button
          onClick={() => setShowModal(true)}
          disabled={loading}
          isLoading={loading}
          variant="outline"
          className="w-full sm:w-auto border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-300"
          icon={<ScanFace className="w-4 h-4" />}
        >
          Setup Face Scan
        </Button>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md h-[80vh] flex flex-col bg-[#0A1628] rounded-3xl overflow-hidden shadow-2xl border border-slate-700"
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-[#0A1628]/95 z-10">
                <h3 className="text-lg font-bold text-white">Enroll Face</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 relative flex flex-col">
                <FaceCapture
                  onCapture={handleFaceCapture}
                  gpsVerified={true}
                  gpsStatus="inside"
                  gpsDistance={0}
                  gpsRefresh={() => {}}
                  isLoading={loading}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
