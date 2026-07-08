'use client';

import React from 'react';
import { WifiOff, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen bg-[#040A15] flex items-center justify-center p-4 text-white font-sans">
      <Card className="max-w-md w-full p-8 text-center bg-[#081226]/90 border-slate-800 shadow-2xl backdrop-blur-xl rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          You Are Currently Offline
        </h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          It looks like your internet connection was interrupted or this page is not available in offline mode. Please check your network and try again.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </Button>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border-slate-700 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </Card>
    </div>
  );
}
