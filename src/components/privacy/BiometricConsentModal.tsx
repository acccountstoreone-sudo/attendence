'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, Camera, MapPin, Eye, Lock, CheckCircle2 } from 'lucide-react';

export interface BiometricConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  employeeName?: string;
}

/**
 * Bilingual (Bengali + English) biometric consent modal (Spec P35).
 * Shown before camera activation on first enrollment and periodically on re-consent schedule.
 */
export const BiometricConsentModal: React.FC<BiometricConsentModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
  employeeName = 'Staff Member',
}) => {
  const [isChecked, setIsChecked] = useState(false);

  const consentPoints = [
    {
      icon: <Camera className="w-4 h-4 text-blue-400 shrink-0" />,
      en: 'Facial biometric data will be captured for attendance verification only.',
      bn: 'উপস্থিতি যাচাইয়ের জন্য শুধুমাত্র মুখমণ্ডলের বায়োমেট্রিক তথ্য সংগ্রহ করা হবে।',
    },
    {
      icon: <MapPin className="w-4 h-4 text-[#1dbf73] shrink-0" />,
      en: 'GPS location is verified to confirm physical store presence during check-in.',
      bn: 'চেক-ইনের সময় দোকানের ভেতরে থাকার নিশ্চয়তার জন্য জিপিএস অবস্থান যাচাই করা হবে।',
    },
    {
      icon: <Lock className="w-4 h-4 text-purple-400 shrink-0" />,
      en: 'Data is encrypted and stored securely per Bangladesh Labor Law and GDPR principles.',
      bn: 'বাংলাদেশ শ্রম আইন এবং GDPR নীতিমালা অনুযায়ী ডেটা এনক্রিপ্টেড ও নিরাপদভাবে সংরক্ষিত।',
    },
    {
      icon: <Eye className="w-4 h-4 text-amber-400 shrink-0" />,
      en: 'Biometric data is never sold, shared with third parties, or used for other purposes.',
      bn: 'বায়োমেট্রিক তথ্য কখনো বিক্রি, তৃতীয় পক্ষকে প্রদান বা অন্য কোনো উদ্দেশ্যে ব্যবহার করা হবে না।',
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />,
      en: 'You may request deletion of your biometric data by contacting HR at any time.',
      bn: 'আপনি যেকোনো সময় এইচআর-এর সাথে যোগাযোগ করে আপনার বায়োমেট্রিক তথ্য মুছে ফেলার অনুরোধ করতে পারবেন।',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDecline}
      title="Biometric Data Consent Notice"
      description="Please read carefully before proceeding with facial recognition check-in"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Header Bilingual Badge */}
        <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-950/80 to-indigo-950/60 p-4 rounded-2xl border border-blue-500/30">
          <ShieldCheck className="w-8 h-8 text-blue-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-900">Anchor Fashion ERP — Privacy Notice</p>
            <p className="text-xs text-blue-300">অ্যাঙ্কর ফ্যাশন ERP — গোপনীয়তা বিজ্ঞপ্তি</p>
            <p className="text-xs text-slate-400 mt-0.5">For: <strong className="text-slate-200">{employeeName}</strong></p>
          </div>
        </div>

        {/* Consent Points — Bilingual */}
        <div className="space-y-3">
          {consentPoints.map((point, i) => (
            <div key={i} className="flex items-start space-x-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="mt-0.5">{point.icon}</div>
              <div>
                <p className="text-xs font-semibold text-slate-200">{point.en}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">{point.bn}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Legal Notice */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <p>
            <strong className="text-slate-200">Legal Basis / আইনী ভিত্তি:</strong> This collection is authorized under the Bangladesh Labour Act 2006 (Section 15), the Digital Security Act, and internal Anchor Fashion HR Policy v2.0.
          </p>
          <p className="mt-1">
            <strong className="text-slate-200">Data Retention / ডেটা সংরক্ষণ:</strong> Attendance records retained for 7 years per labor law. Biometric templates purged after employment ends + 90 days.
          </p>
        </div>

        {/* Consent Checkbox */}
        <div
          className="flex items-start space-x-3 p-4 bg-blue-950/30 border border-blue-500/30 rounded-xl cursor-pointer"
          onClick={() => setIsChecked(!isChecked)}
        >
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-slate-950'}`}>
            {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-200">
              I have read, understood, and voluntarily consent to biometric data processing for attendance purposes.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              আমি পড়েছি, বুঝেছি এবং উপস্থিতির উদ্দেশ্যে বায়োমেট্রিক তথ্য প্রক্রিয়াকরণে স্বেচ্ছায় সম্মত।
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDecline}
          >
            Decline / প্রত্যাখ্যান করুন
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!isChecked}
            onClick={onAccept}
            icon={<ShieldCheck className="w-4 h-4" />}
          >
            I Consent / আমি সম্মত
          </Button>
        </div>
      </div>
    </Modal>
  );
};

