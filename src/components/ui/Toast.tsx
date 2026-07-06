'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info' | 'alert';

export interface ToastProps {
  id?: string;
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number; // in milliseconds
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  title,
  message,
  type = 'info',
  duration = 5000,
  onDismiss,
}) => {
  useEffect(() => {
    if (duration > 0 && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
    alert: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100 shadow-emerald-900/20',
    warning: 'border-amber-500/40 bg-amber-950/90 text-amber-100 shadow-amber-900/20',
    error: 'border-rose-500/40 bg-rose-950/90 text-rose-100 shadow-rose-900/20',
    info: 'border-blue-500/40 bg-blue-950/90 text-blue-100 shadow-blue-900/20',
    alert: 'border-rose-500/40 bg-rose-950/90 text-rose-100 shadow-rose-900/20',
  };

  return (
    <div
      className={cn(
        'flex items-start space-x-3 p-4 rounded-xl border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-sm w-full',
        borders[type]
      )}
    >
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{title}</p>
        {message && <p className="text-xs opacity-90 mt-0.5 line-clamp-2">{message}</p>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
