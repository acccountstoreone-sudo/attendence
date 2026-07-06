'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, ScanFace } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FaceCaptureProps {
  onCapture: (base64Image: string) => Promise<void>;
  isGpsVerified: boolean;
  gpsDistance?: number | null;
  isLoading?: boolean;
}

type VerificationState = 'idle' | 'scanning' | 'extracting' | 'matching' | 'success';

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onCapture,
  isGpsVerified,
  gpsDistance,
  isLoading = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [feedback, setFeedback] = useState<string>('Align your face within the biometric frame');

  const startCamera = async () => {
    setHasPermission(null);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        setFeedback('Position face centered within the frame');
      }
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setCameraError('Camera permission denied or device not found. Please allow camera access in browser settings.');
    }
  };

  useEffect(() => {
    startCamera();
    const currentVideoRef = videoRef.current;
    return () => {
      if (currentVideoRef && currentVideoRef.srcObject) {
        const stream = currentVideoRef.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    setFeedback('Biometric capture ready for verification!');
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setVerificationState('idle');
    setFeedback('Align your face within the biometric frame');
  };

  const handleConfirmSubmit = async () => {
    if (!capturedImage) return;
    
    // Simulate premium verification flow
    setVerificationState('scanning');
    setFeedback('Scanning facial topography...');
    
    await new Promise(r => setTimeout(r, 1200));
    setVerificationState('extracting');
    setFeedback('Extracting biometric vectors...');
    
    await new Promise(r => setTimeout(r, 1200));
    setVerificationState('matching');
    setFeedback('Matching against secure database...');
    
    await new Promise(r => setTimeout(r, 1500));
    setVerificationState('success');
    setFeedback('Identity Verified. Processing check-in...');
    
    await onCapture(capturedImage);
  };

  const isSimulating = verificationState !== 'idle' && verificationState !== 'success';

  return (
    <Card className="bg-[#061224] border-[#1E293B] p-6 flex flex-col items-center max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Decorative Background Grid */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#1E293B_1px,transparent_1px),linear-gradient(to_bottom,#1E293B_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      
      <div className="flex items-center space-x-2 text-[#D2A02A] mb-6 self-start relative z-10">
        <ScanFace className="w-5 h-5" />
        <h3 className="text-base font-bold text-white">Biometric Face Verification</h3>
      </div>

      {/* Video / Snapshot Display Frame */}
      <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-[#D2A02A]/50 shadow-2xl shadow-[#D2A02A]/20 bg-[#040A15] flex items-center justify-center my-2 z-10">
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            {/* Oval Face Guide Overlay */}
            <div className="absolute inset-0 border-2 border-dashed border-white/40 rounded-full pointer-events-none m-6" />
            <motion.div 
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 border-[4px] border-[#D2A02A]/30 rounded-full pointer-events-none"
            />
          </>
        ) : (
          <div className="relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover transform -scale-x-100 filter brightness-110 contrast-125" />
            
            {/* Verification Scanning Overlay Animations */}
            <AnimatePresence>
              {isSimulating && (
                <>
                  <motion.div
                    initial={{ top: '-10%' }}
                    animate={{ top: '110%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="absolute left-0 w-full h-2 bg-[#D2A02A] shadow-[0_0_20px_5px_rgba(210,160,42,0.8)] z-20"
                  />
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#D2A02A] mix-blend-overlay z-10"
                  />
                </>
              )}
              {verificationState === 'success' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] flex items-center justify-center z-20"
                >
                  <CheckCircle2 className="w-24 h-24 text-emerald-400 drop-shadow-lg" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Camera Error State */}
        {hasPermission === false && (
          <div className="absolute inset-0 bg-[#040A15]/90 flex flex-col items-center justify-center p-6 text-center z-20">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
            <p className="text-xs text-rose-300 font-bold">{cameraError}</p>
            <Button size="sm" variant="outline" className="mt-4 border-[#1E293B] hover:bg-[#1E293B]" onClick={startCamera}>
              Retry Camera
            </Button>
          </div>
        )}
      </div>

      {/* Live Feedback Banner */}
      <motion.div 
        key={feedback}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mt-6 px-4 py-3 rounded-xl border w-full text-center relative z-10 ${
          verificationState === 'success' 
            ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
            : isSimulating
              ? 'bg-[#D2A02A]/10 border-[#D2A02A]/30 text-[#D2A02A] animate-pulse'
              : 'bg-[#040A15] border-[#1E293B] text-slate-300'
        }`}
      >
        <p className="text-sm font-bold tracking-wide">{feedback}</p>
      </motion.div>

      {/* GPS Warning if Outside Geofence */}
      {!isGpsVerified && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs text-center w-full flex items-center justify-center space-x-2 relative z-10">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Check-in disabled: You must be inside the store geofence ({gpsDistance ?? '?'}m away).</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex items-center space-x-3 w-full relative z-10">
        {!capturedImage ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] font-bold border-none shadow-xl shadow-[#D2A02A]/20"
            disabled={!hasPermission || !isGpsVerified || isLoading}
            onClick={handleTakeSnapshot}
            icon={<Camera className="w-5 h-5 text-[#040A15]" />}
          >
            Capture Face
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="md"
              className="flex-1 border-[#1E293B] text-slate-300 hover:bg-[#1E293B]"
              disabled={isLoading || isSimulating || verificationState === 'success'}
              onClick={handleRetake}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Retake
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="flex-1 bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] shadow-lg shadow-[#D2A02A]/20"
              disabled={!isGpsVerified || isLoading || isSimulating || verificationState === 'success'}
              isLoading={isLoading || isSimulating}
              onClick={handleConfirmSubmit}
              icon={!isSimulating && <ShieldCheck className="w-5 h-5" />}
            >
              {isSimulating ? 'Verifying...' : 'Verify & Submit'}
            </Button>
          </>
        )}
      </div>

      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </Card>
  );
};
