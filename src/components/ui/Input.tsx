import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dbf73]/30 focus-visible:border-[#1dbf73] disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-xs',
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';

