'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    faceIO: (publicId: string) => FaceIOInstance;
    faceioInit: boolean;
  }
}

interface FaceIOInstance {
  enroll: (options?: FaceIOEnrollOptions) => Promise<FaceIOEnrollResult>;
  authenticate: (options?: FaceIOAuthOptions) => Promise<FaceIOAuthResult>;
  restartSession: () => void;
}

interface FaceIOEnrollOptions {
  locale?: string;
  permissionTimeout?: number;
  idTimeout?: number;
  replyTimeout?: number;
  enrollIntroTimeout?: number;
  userConsent?: boolean;
  payload?: Record<string, unknown>;
}

interface FaceIOEnrollResult {
  facialId: string;
  timestamp: string;
  details: { frameCount: number; [key: string]: unknown };
}

interface FaceIOAuthOptions {
  locale?: string;
  permissionTimeout?: number;
  idTimeout?: number;
  replyTimeout?: number;
}

interface FaceIOAuthResult {
  facialId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  details?: { frameCount: number; [key: string]: unknown };
}

let faceioInstance: FaceIOInstance | null = null;

/**
 * Loads the FaceIO SDK script lazily (Spec P40).
 * Must be called before enroll/authenticate.
 */
export async function loadFaceIO(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR: FaceIO unavailable server-side'));
    if (window.faceioInit) return resolve();

    const script = document.createElement('script');
    script.src = 'https://cdn.faceio.net/fio.js';
    script.async = true;
    script.onload = () => {
      window.faceioInit = true;
      resolve();
    };
    script.onerror = () => reject(new Error('FaceIO SDK failed to load'));
    document.head.appendChild(script);
  });
}

/**
 * Initializes the FaceIO instance.
 */
export async function initFaceIO(): Promise<FaceIOInstance> {
  if (faceioInstance) return faceioInstance;

  await loadFaceIO();
  const appId = process.env.NEXT_PUBLIC_FACEIO_APP_ID;
  if (!appId) throw new Error('NEXT_PUBLIC_FACEIO_APP_ID is not configured in .env.local');

  faceioInstance = window.faceIO(appId);
  return faceioInstance;
}

/**
 * Enrolls a new employee face (first-time biometric registration).
 * Links the facialId to the employee's userId as a metadata payload.
 */
export async function enrollFace(employeeUserId: string): Promise<FaceIOEnrollResult> {
  const faceio = await initFaceIO();

  const result = await faceio.enroll({
    locale: 'auto',
    userConsent: true,
    payload: { userId: employeeUserId, system: 'AnchorFashionERP', enrolledAt: new Date().toISOString() },
    permissionTimeout: 15,
    idTimeout: 60,
    replyTimeout: 40,
  });

  return result;
}

/**
 * Authenticates an employee using their previously enrolled face.
 * Returns the facialId which must be looked up against the employee's stored facialId.
 */
export async function authenticateFace(): Promise<FaceIOAuthResult> {
  const faceio = await initFaceIO();

  const result = await faceio.authenticate({
    locale: 'auto',
    permissionTimeout: 15,
    idTimeout: 60,
    replyTimeout: 40,
  });

  return result;
}

/**
 * Maps FaceIO error codes to user-friendly messages.
 */
export function getFaceIOErrorMessage(errCode: number): string {
  const errors: Record<number, string> = {
    1: 'Permission denied — camera access blocked. Please enable in browser settings.',
    2: 'No internet connection. Please check your network.',
    3: 'FaceIO session expired. Refreshing...',
    4: 'No face detected. Please position your face in the frame.',
    5: 'Face detected but no match found. Please try again.',
    6: 'Face registered already. No need to re-enroll.',
    7: 'Processing timeout. Please retry.',
    8: 'Duplicate enrollment detected.',
    200: 'Unauthorized face. Access denied.',
    201: 'Face was covered or obscured. Please remove mask/glasses.',
    202: 'Spoofing detected. Live face required.',
  };
  return errors[errCode] || `Authentication error (code ${errCode}). Please contact IT support.`;
}
