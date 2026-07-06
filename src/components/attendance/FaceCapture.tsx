'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';

export interface FaceCaptureProps {
  onCapture: (base64Image: string) => Promise<void>;
  isGpsVerified: boolean;
  gpsDistance?: number | null;
  isLoading?: boolean;
}

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
    return () => {
      // Stop camera tracks on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
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
    setFeedback('Align your face within the biometric frame');
  };

  const handleConfirmSubmit = async () => {
    if (!capturedImage) return;
    setFeedback('Verifying facial biometrics with server...');
    await onCapture(capturedImage);
  };

  return (
    <Card className="bg-[#061224] border-[#1E293B] p-6 flex flex-col items-center max-w-md mx-auto shadow-2xl">
      <div className="flex items-center space-x-2 text-[#D2A02A] mb-4 self-start">
        <ShieldCheck className="w-5 h-5" />
        <h3 className="text-base font-bold text-white">Biometric Face Verification</h3>
      </div>

      {/* Video / Snapshot Display Frame */}
      <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-[#D2A02A]/50 shadow-2xl shadow-[#D2A02A]/20 bg-[#040A15] flex items-center justify-center my-2">
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
            <div className="absolute inset-0 border-2 border-dashed border-white/40 rounded-full pointer-events-none m-6 animate-pulse" />
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover transform -scale-x-100" />
        )}

        {/* Camera Error State */}
        {hasPermission === false && (
          <div className="absolute inset-0 bg-[#040A15]/90 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
            <p className="text-xs text-rose-300 font-bold">{cameraError}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={startCamera}>
              Retry Camera
            </Button>
          </div>
        )}
      </div>

      {/* Live Feedback Banner */}
      <div className="mt-4 px-4 py-2 rounded-xl bg-[#040A15] border border-[#1E293B] w-full text-center">
        <p className="text-xs font-bold text-slate-300">{feedback}</p>
      </div>

      {/* GPS Warning if Outside Geofence */}
      {!isGpsVerified && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs text-center w-full flex items-center justify-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Check-in disabled: You must be inside the store geofence ({gpsDistance ?? '?'}m away).</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex items-center space-x-3 w-full">
        {!capturedImage ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] font-bold border-none"
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
              disabled={isLoading}
              onClick={handleRetake}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Retake
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="flex-1 bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] shadow-[#D2A02A]/20"
              disabled={!isGpsVerified || isLoading}
              isLoading={isLoading}
              onClick={handleConfirmSubmit}
              icon={<CheckCircle2 className="w-5 h-5" />}
            >
              Confirm Check-In
            </Button>
          </>
        )}
      </div>

      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </Card>
  );
};
