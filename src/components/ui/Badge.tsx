import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeStatus = 'present' | 'late' | 'absent' | 'half_day' | 'pending' | 'active' | 'inactive' | 'info' | 'success' | 'warning' | 'error';
export type BadgeVariant = 'solid' | 'outline' | 'subtle' | 'info' | 'success' | 'warning' | 'error';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({
  status = 'pending',
  variant = 'subtle',
  className,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors';

  const statusColors: Record<string, Record<string, string>> = {
    present: {
      subtle: 'bg-emerald-50 text-emerald-800 border border-emerald-300/70 font-semibold shadow-2xs',
      solid: 'bg-[#1dbf73] text-white font-bold shadow-xs',
      outline: 'border border-emerald-500 text-emerald-700 font-semibold',
    },
    active: {
      subtle: 'bg-emerald-50 text-emerald-800 border border-emerald-300/70 font-semibold shadow-2xs',
      solid: 'bg-[#1dbf73] text-white font-bold shadow-xs',
      outline: 'border border-emerald-500 text-emerald-700 font-semibold',
    },
    late: {
      subtle: 'bg-amber-50 text-amber-800 border border-amber-300/70 font-semibold shadow-2xs',
      solid: 'bg-amber-500 text-white font-bold shadow-xs',
      outline: 'border border-amber-500 text-amber-700 font-semibold',
    },
    absent: {
      subtle: 'bg-rose-50 text-rose-800 border border-rose-300/70 font-semibold shadow-2xs',
      solid: 'bg-rose-600 text-white font-bold shadow-xs',
      outline: 'border border-rose-500 text-rose-700 font-semibold',
    },
    inactive: {
      subtle: 'bg-rose-50 text-rose-800 border border-rose-300/70 font-semibold shadow-2xs',
      solid: 'bg-rose-600 text-white font-bold shadow-xs',
      outline: 'border border-rose-500 text-rose-700 font-semibold',
    },
    half_day: {
      subtle: 'bg-blue-50 text-blue-800 border border-blue-300/70 font-semibold shadow-2xs',
      solid: 'bg-blue-600 text-white font-bold shadow-xs',
      outline: 'border border-blue-500 text-blue-700 font-semibold',
    },
    pending: {
      subtle: 'bg-slate-100 text-slate-700 border border-slate-300 font-semibold',
      solid: 'bg-slate-700 text-white font-bold shadow-xs',
      outline: 'border border-slate-400 text-slate-700 font-semibold',
    },
  };

  const semanticVariants: Record<string, string> = {
    info: 'bg-blue-50 text-blue-800 border border-blue-300/70 font-semibold shadow-2xs',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-300/70 font-semibold shadow-2xs',
    warning: 'bg-amber-50 text-amber-800 border border-amber-300/70 font-semibold shadow-2xs',
    error: 'bg-rose-50 text-rose-800 border border-rose-300/70 font-semibold shadow-2xs',
  };

  let selectedColor = statusColors[status]?.[variant || 'subtle'] || statusColors.pending.subtle;
  if (variant && semanticVariants[variant]) {
    selectedColor = semanticVariants[variant];
  } else if (status && semanticVariants[status]) {
    selectedColor = semanticVariants[status];
  }

  const dotColor =
    variant === 'success' || status === 'present' || status === 'active' || status === 'success' ? 'bg-[#1dbf73]' :
    variant === 'warning' || status === 'late' || status === 'warning' ? 'bg-amber-400' :
    variant === 'error' || status === 'absent' || status === 'inactive' || status === 'error' ? 'bg-rose-400' :
    variant === 'info' || status === 'half_day' || status === 'info' ? 'bg-indigo-400' : 'bg-slate-400';

  return (
    <span className={cn(baseStyles, selectedColor, className)} {...props}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse', dotColor)} />
      {children || status.replace('_', ' ')}
    </span>
  );
};

