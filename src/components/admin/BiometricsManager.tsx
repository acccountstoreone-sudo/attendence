'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ScanFace, Fingerprint, Trash2, CheckCircle2, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function BiometricsManager({ employee, webauthnCredentials }: { employee: any, webauthnCredentials: any[] }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const router = useRouter();

  const handleResetFace = async () => {
    if (!confirm("Are you sure you want to delete this employee's face data? They will be required to re-enroll their face.")) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}/reset-face-verification`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to reset face.');
      
      setFeedback({ type: 'success', text: 'Face verification data deleted. Employee has been notified.' });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFingerprint = async (credentialId: string) => {
    if (!confirm('Are you sure you want to delete this fingerprint?')) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}/biometrics/fingerprint/${credentialId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed to delete fingerprint.');
      
      setFeedback({ type: 'success', text: 'Fingerprint credential deleted. Employee has been notified.' });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={`p-4 rounded-xl border text-sm font-medium flex items-center gap-3 ${feedback.type === 'success' ? 'bg-[#1dbf73]/10 border-emerald-500/20 text-[#1dbf73]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
           {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
           <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Face Recognition Card */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-6 relative">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#1dbf73]/10 rounded-xl text-[#1dbf73]">
                <ScanFace className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Face Verification</h3>
                <p className="text-sm text-slate-400">Primary biometric check-in</p>
              </div>
            </div>
            {employee.face_enrolled ? (
              <span className="px-2.5 py-1 bg-[#1dbf73]/10 text-[#1dbf73] text-xs font-medium rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#1dbf73]" /> Enrolled
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Not Enrolled
              </span>
            )}
          </div>

          {employee.face_enrolled && employee.photo_url ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-[#1dbf73] relative">
                <img src={employee.photo_url} alt="Face Enrollment" className="w-full h-full object-cover" />
              </div>
              <Button onClick={handleResetFace} disabled={loading} variant="outline" className="w-full text-rose-400 border-rose-500/30 hover:bg-rose-500/10 gap-2">
                <Trash2 className="w-4 h-4" /> Reset Face Data
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No face data found.</p>
              {employee.requires_face_reverification && (
                 <p className="text-xs text-amber-500 mt-2">Employee is currently required to re-verify.</p>
              )}
            </div>
          )}
        </div>

        {/* Fingerprints Card */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Registered Devices</h3>
                <p className="text-sm text-slate-400">Passkeys & Fingerprints</p>
              </div>
            </div>
            <span className="text-slate-400 text-sm font-medium">{webauthnCredentials.length} Saved</span>
          </div>

          <div className="space-y-3">
            {webauthnCredentials.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-xl">
                 <Smartphone className="w-8 h-8 mb-2 opacity-50" />
                 <p className="text-sm">No devices registered.</p>
               </div>
            ) : (
               webauthnCredentials.map((cred: any) => (
                 <div key={cred.id} className="flex items-center justify-between p-4 bg-[#ffffff] border border-slate-200 rounded-xl hover:border-blue-500/30 transition-colors">
                   <div className="flex items-center gap-3 overflow-hidden">
                     <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                       <Smartphone className="w-5 h-5 text-blue-400" />
                     </div>
                     <div className="min-w-0">
                       <p className="text-sm font-medium text-slate-700 truncate">{cred.device_type === 'singleDevice' ? 'Single Device (Phone/Mac)' : 'Security Key'}</p>
                       <p className="text-xs text-slate-500 truncate">ID: {cred.credential_id.substring(0, 16)}...</p>
                       <p className="text-[10px] text-slate-600 mt-0.5">Added: {new Date(cred.created_at).toLocaleString()}</p>
                     </div>
                   </div>
                   <button 
                     onClick={() => handleDeleteFingerprint(cred.id)}
                     disabled={loading}
                     className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-2 shrink-0"
                     title="Remove Device"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
