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
      subtle: 'bg-emerald-950/80 text-[#1dbf73] border border-emerald-500/30 shadow-sm shadow-emerald-500/10',
      solid: 'bg-[#16965a] text-slate-900',
      outline: 'border border-emerald-500 text-[#1dbf73]',
    },
    active: {
      subtle: 'bg-emerald-950/80 text-[#1dbf73] border border-emerald-500/30',
      solid: 'bg-[#16965a] text-slate-900',
      outline: 'border border-emerald-500 text-[#1dbf73]',
    },
    late: {
      subtle: 'bg-amber-950/80 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10',
      solid: 'bg-amber-600 text-slate-900',
      outline: 'border border-amber-500 text-amber-400',
    },
    absent: {
      subtle: 'bg-rose-950/80 text-rose-300 border border-rose-500/30 shadow-sm shadow-rose-500/10',
      solid: 'bg-rose-600 text-slate-900',
      outline: 'border border-rose-500 text-rose-400',
    },
    inactive: {
      subtle: 'bg-rose-950/80 text-rose-300 border border-rose-500/30',
      solid: 'bg-rose-600 text-slate-900',
      outline: 'border border-rose-500 text-rose-400',
    },
    half_day: {
      subtle: 'bg-blue-950/80 text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-500/10',
      solid: 'bg-blue-600 text-slate-900',
      outline: 'border border-blue-500 text-blue-400',
    },
    pending: {
      subtle: 'bg-slate-800 text-slate-300 border border-slate-700',
      solid: 'bg-slate-700 text-slate-900',
      outline: 'border border-slate-600 text-slate-400',
    },
  };

  const semanticVariants: Record<string, string> = {
    info: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-sm',
    success: 'bg-[#1dbf73]/10 text-[#1dbf73] border border-emerald-500/20 shadow-sm',
    warning: 'bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm',
    error: 'bg-rose-500/10 text-rose-300 border border-rose-500/20 shadow-sm',
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

