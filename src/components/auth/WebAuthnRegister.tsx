'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Fingerprint, AlertCircle, CheckCircle2 } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

export function WebAuthnRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const registerFingerprint = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Get registration options from server
      const resp = await fetch('/api/auth/webauthn/register/generate', { method: 'POST' });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Failed to get registration options');
      }
      const options = await resp.json();

      // 2. Pass options to browser authenticator (Fingerprint/FaceID)
      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: options });
      } catch (e: any) {
        if (e.name === 'NotAllowedError') {
           throw new Error('Registration cancelled or timed out.');
        } else if (e.name === 'NotSupportedError') {
           throw new Error('Your device does not support fingerprint/biometric registration on the web.');
        }
        throw e;
      }

      // 3. Send response back to server for verification
      const verifyResp = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      });

      if (!verifyResp.ok) {
        const errData = await verifyResp.json();
        throw new Error(errData.error || 'Failed to verify registration');
      }

      const verifyData = await verifyResp.json();
      if (verifyData.verified) {
        setSuccess(true);
      } else {
        throw new Error('Verification failed on the server.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during fingerprint setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3 text-sm text-slate-300">
        <Fingerprint className="w-5 h-5 text-indigo-400" />
        <div>
          <p className="font-medium text-slate-200">Device Fingerprint / Passkey</p>
          <p className="text-xs text-slate-400">Register this device to check in without face verification.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start space-x-2 p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="flex items-center space-x-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Fingerprint successfully registered for this device!</span>
        </div>
      ) : (
        <Button
          onClick={registerFingerprint}
          disabled={loading}
          isLoading={loading}
          variant="outline"
          className="w-full sm:w-auto border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-300"
          icon={<Fingerprint className="w-4 h-4" />}
        >
          Setup Fingerprint
        </Button>
      )}
    </div>
  );
}
