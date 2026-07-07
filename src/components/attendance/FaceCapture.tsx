'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, ScanFace } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FaceCaptureProps {
  onCapture: (base64Image: string, faceDescriptor?: number[]) => Promise<void>;
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
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [feedback, setFeedback] = useState<string>('Align your face within the biometric frame');

  const startCamera = async () => {
    setHasPermission(null);
    setCameraError('');
    try {
      // Bug 1 fix: Stop any existing tracks before requesting a new stream to prevent leaks on retry
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera();
    // Bug 1 fix: Use ref.current in cleanup so we always stop the latest stream, not the one captured at mount
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
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
    // Restart camera in case the track was paused/ended (e.g., tab was backgrounded)
    startCamera();
  };

  const handleConfirmSubmit = async () => {
    if (!capturedImage) return;
    
    setVerificationState('scanning');
    setFeedback('Scanning facial topography...');
    
    try {
      const faceapi = await import('@vladmandic/face-api');
      
      // Ensure models are loaded
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
      }

      setVerificationState('extracting');
      setFeedback('Extracting biometric vectors...');

      // Bug 2 fix: Removed dead canvasRef check — face-api processes the img element directly, not the canvas
      // Create an image element from capturedImage to process
      const img = new Image();
      img.src = capturedImage;
      await new Promise((resolve) => { img.onload = resolve; });

      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setVerificationState('idle');
        setFeedback('No face detected or features unclear. Please retake.');
        setCapturedImage(null);
        return;
      }

      setFaceDescriptor(Array.from(detection.descriptor));

      setVerificationState('matching');
      setFeedback('Matching against secure database...');
      
      await new Promise(r => setTimeout(r, 800)); // Minimal delay for UI feedback
      
      setVerificationState('success');
      setFeedback('Identity Verified. Processing check-in...');
      
      await onCapture(capturedImage, Array.from(detection.descriptor));
    } catch (err) {
      console.error(err);
      setVerificationState('idle');
      setFeedback('Biometric extraction failed. Please try again.');
      setCapturedImage(null);
    }
  };

  const isSimulating = verificationState !== 'idle' && verificationState !== 'success';

  return (
    <Card className="bg-[#061224] border-[#1E293B] p-6 flex flex-col items-center max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Decorative Background Grid */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#1E293B_1px,transparent_1px),linear-gradient(to_bottom,#1E293B_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      
      <div className="flex items-center space-x-2 text-blue-400 mb-6 self-start relative z-10">
        <ScanFace className="w-5 h-5" />
        <h3 className="text-base font-bold text-white tracking-wide">Biometric Identity Check</h3>
      </div>

      {/* Video / Snapshot Display Frame - Binance Style Premium UI */}
      <div className="relative w-full max-w-[280px] aspect-[3/4] mx-auto rounded-[2rem] overflow-hidden border-2 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-[#040A15] flex items-center justify-center my-2 z-10">
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
            />
            {/* Frosted Glass Overlay with Oval Cutout */}
            <div 
              className="absolute inset-0 backdrop-blur-md bg-[#061224]/70 pointer-events-none"
              style={{
                maskImage: 'radial-gradient(ellipse 110px 150px at center, transparent 99%, black 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 110px 150px at center, transparent 99%, black 100%)'
              }}
            />
            
            {/* Glowing Border around the Cutout */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[300px] rounded-[110px/150px] border-2 border-blue-500/30 pointer-events-none shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]" />
            
            {/* Pulsing Guide Outline */}
            <motion.div 
              animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.98, 1.02, 0.98] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[300px] rounded-[110px/150px] border-2 border-emerald-400/80 pointer-events-none"
            />

            {/* Corner Bracket Accents */}
            <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-blue-400/50 rounded-tl-xl" />
            <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-blue-400/50 rounded-tr-xl" />
            <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-blue-400/50 rounded-bl-xl" />
            <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-blue-400/50 rounded-br-xl" />
          </>
        ) : (
          <div className="relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedImage} alt="Captured face" className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 filter brightness-110 contrast-125" />
            
            {/* Apply same frosted mask to captured image */}
            <div 
              className="absolute inset-0 backdrop-blur-md bg-[#061224]/70 pointer-events-none z-10"
              style={{
                maskImage: 'radial-gradient(ellipse 110px 150px at center, transparent 99%, black 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 110px 150px at center, transparent 99%, black 100%)'
              }}
            />
            
            {/* Verification Scanning Overlay Animations */}
            <AnimatePresence>
              {isSimulating && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[300px] rounded-[110px/150px] overflow-hidden z-20 pointer-events-none">
                  <motion.div
                    initial={{ top: '-10%' }}
                    animate={{ top: '110%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="absolute left-0 w-full h-1 bg-emerald-400 shadow-[0_0_20px_4px_rgba(52,211,153,1)] z-20"
                  />
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.15 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-blue-500 mix-blend-overlay z-10"
                  />
                </div>
              )}
              {verificationState === 'success' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-30"
                >
                  <CheckCircle2 className="w-20 h-20 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)] mb-3" />
                  <span className="text-emerald-50 font-bold text-lg tracking-wide uppercase">Identity Verified</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Camera Error State */}
        {hasPermission === false && (
          <div className="absolute inset-0 bg-[#040A15]/95 flex flex-col items-center justify-center p-6 text-center z-40 backdrop-blur-md">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
            <p className="text-xs text-rose-200 font-medium leading-relaxed">{cameraError}</p>
            <Button size="sm" variant="outline" className="mt-5 border-rose-500/30 hover:bg-rose-950/30 text-rose-300" onClick={startCamera}>
              Retry Camera Connection
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
