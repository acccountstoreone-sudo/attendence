'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CheckCircle, XCircle, User, Mail, Building2, CreditCard, ShieldCheck, FileText, Expand, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';

export interface KYCReviewEmployee {
  id: string;
  full_name: string;
  email: string;
  branch_name?: string;
  nid?: string;
  nid_front_url?: string;
  nid_back_url?: string;
}

interface KYCReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: KYCReviewEmployee | null;
  onApprove: (id: string, action: 'approve' | 'reject') => Promise<void>;
  loading?: boolean;
}

export const KYCReviewModal: React.FC<KYCReviewModalProps> = ({
  isOpen,
  onClose,
  employee,
  onApprove,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  const [isZoomed, setIsZoomed] = useState(false);

  if (!employee) return null;

  const currentImage = activeTab === 'front' ? employee.nid_front_url : employee.nid_back_url;
  const isMissingFront = !employee.nid_front_url;
  const isMissingBack = !employee.nid_back_url;
  const isMissingBoth = isMissingFront && isMissingBack;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="5xl"
      hideHeader
      noPadding
    >
      <div className="flex flex-col md:flex-row min-h-[650px] bg-white rounded-2xl overflow-hidden">
        
        {/* Left Pane: User Details & Verification Status */}
        <div className="w-full md:w-[350px] lg:w-[400px] border-r border-slate-200 bg-white/50 p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Identity Review</h2>
              <p className="text-xs text-slate-400 mt-1">Global Security & Compliance</p>
            </div>
          </div>

          <div className="space-y-6 flex-1">
            {/* Applicant Profile */}
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Applicant Profile</p>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <User className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Full Legal Name</p>
                    <p className="text-sm font-bold text-slate-900">{employee.full_name}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <Mail className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Email Address</p>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]" title={employee.email}>{employee.email}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <Building2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Assigned Branch</p>
                    <p className="text-sm font-bold text-slate-900">{employee.branch_name || 'Global / Unassigned'}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <CreditCard className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">National ID Number</p>
                    <p className="text-sm font-bold text-slate-900">{employee.nid || 'Not Provided'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f1f5f9] to-transparent my-6" />

            {/* Verification Status */}
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Automated Checks</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1dbf73]/5 border border-emerald-500/10">
                  <span className="text-xs text-slate-600 font-medium">Liveness Check</span>
                  <Badge status="present" variant="solid" className="text-[10px]">Passed</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                  <span className="text-xs text-slate-600 font-medium">Face Enrollment</span>
                  <Badge status="present" variant="solid" className="text-[10px]">Captured</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/30 border border-slate-200">
                  <span className="text-xs text-slate-600 font-medium">Document Scan</span>
                  {isMissingBoth ? (
                    <Badge status="absent" variant="solid" className="text-[10px]">Missing</Badge>
                  ) : (
                    <Badge status="late" variant="solid" className="text-[10px]">Manual Review</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Document Viewer */}
        <div className="flex-1 flex flex-col bg-white relative">
          {/* Top Bar */}
          <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white backdrop-blur-sm z-10">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Document Inspector</span>
            </div>
            
            {/* Tab Switcher */}
            <div className="flex p-1 bg-white border border-slate-200 rounded-lg">
              <button 
                onClick={() => setActiveTab('front')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === 'front' 
                    ? 'bg-slate-100 text-slate-900 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Front Side
              </button>
              <button 
                onClick={() => setActiveTab('back')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === 'back' 
                    ? 'bg-slate-100 text-slate-900 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Back Side
              </button>
            </div>
          </div>

          {/* Image Canvas */}
          <div className="flex-1 relative overflow-hidden bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-[#ffffff]">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center p-8"
              >
                {currentImage ? (
                  <div className="relative group w-full h-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={currentImage} 
                      alt={`NID ${activeTab}`} 
                      className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300 ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in hover:scale-105'}`}
                      onClick={() => setIsZoomed(!isZoomed)}
                    />
                    <div className="absolute bottom-4 right-4 bg-white/40 backdrop-blur-md border border-slate-200 text-slate-900 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-2">
                      <Expand className="w-4 h-4" />
                      <span className="text-xs font-medium">Click to {isZoomed ? 'zoom out' : 'zoom in'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl max-w-sm mx-auto">
                    <AlertTriangle className="w-12 h-12 text-slate-500 mb-4" />
                    <p className="text-slate-600 font-bold mb-2">Document Missing</p>
                    <p className="text-xs text-slate-500">The employee did not upload the {activeTab} side of their National ID.</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Footer */}
          <div className="p-6 border-t border-slate-200 bg-white flex items-center justify-between">
            <Button 
              variant="ghost" 
              className="text-slate-400 hover:text-slate-900"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20"
                onClick={async () => {
                  await onApprove(employee.id, 'reject');
                  onClose();
                }}
                disabled={loading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button 
                variant="primary" 
                className="bg-gradient-to-r from-[#1dbf73] to-[#B08015] hover:from-[#16965a] hover:to-[#9F700B] text-black font-extrabold border-none shadow-[0_0_15px_rgba(210,160,42,0.3)] hover:shadow-[0_0_25px_rgba(210,160,42,0.5)] transition-all px-6"
                onClick={async () => {
                  await onApprove(employee.id, 'approve');
                  onClose();
                }}
                disabled={loading}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Approve & Enroll
              </Button>
            </div>
          </div>
        </div>
        
      </div>
    </Modal>
  );
};

