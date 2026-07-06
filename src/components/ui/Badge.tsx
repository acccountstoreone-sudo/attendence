import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeStatus = 'present' | 'late' | 'absent' | 'half_day' | 'pending' | 'active' | 'inactive';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  variant?: 'solid' | 'outline' | 'subtle';
}

export const Badge: React.FC<BadgeProps> = ({
  status = 'pending',
  variant = 'subtle',
  className,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors';

  const statusColors = {
    present: {
      subtle: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10',
      solid: 'bg-emerald-600 text-white',
      outline: 'border border-emerald-500 text-emerald-400',
    },
    active: {
      subtle: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
      solid: 'bg-emerald-600 text-white',
      outline: 'border border-emerald-500 text-emerald-400',
    },
    late: {
      subtle: 'bg-amber-950/80 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10',
      solid: 'bg-amber-600 text-white',
      outline: 'border border-amber-500 text-amber-400',
    },
    absent: {
      subtle: 'bg-rose-950/80 text-rose-300 border border-rose-500/30 shadow-sm shadow-rose-500/10',
      solid: 'bg-rose-600 text-white',
      outline: 'border border-rose-500 text-rose-400',
    },
    inactive: {
      subtle: 'bg-rose-950/80 text-rose-300 border border-rose-500/30',
      solid: 'bg-rose-600 text-white',
      outline: 'border border-rose-500 text-rose-400',
    },
    half_day: {
      subtle: 'bg-blue-950/80 text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-500/10',
      solid: 'bg-blue-600 text-white',
      outline: 'border border-blue-500 text-blue-400',
    },
    pending: {
      subtle: 'bg-slate-800 text-slate-300 border border-slate-700',
      solid: 'bg-slate-700 text-white',
      outline: 'border border-slate-600 text-slate-400',
    },
  };

  const selectedColor = statusColors[status]?.[variant] || statusColors.pending.subtle;

  return (
    <span className={cn(baseStyles, selectedColor, className)} {...props}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse', 
        status === 'present' || status === 'active' ? 'bg-emerald-400' :
        status === 'late' ? 'bg-amber-400' :
        status === 'absent' || status === 'inactive' ? 'bg-rose-400' :
        status === 'half_day' ? 'bg-blue-400' : 'bg-slate-400'
      )} />
      {children || status.replace('_', ' ')}
    </span>
  );
};
