import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'bordered' | 'interactive' | 'glass';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'elevated', children, ...props }, ref) => {
    const baseStyles = 'rounded-2xl p-6 transition-all duration-200';
    
    const variants = {
      elevated: 'bg-[#040A15]/40 backdrop-blur-3xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] text-slate-100',
      bordered: 'bg-transparent border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] text-slate-100',
      interactive: 'bg-[#040A15]/40 backdrop-blur-3xl border border-white/5 hover:border-white/20 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_12px_40px_rgba(0,0,0,0.6)] cursor-pointer text-slate-100 transform hover:-translate-y-1 transition-all duration-300',
      glass: 'bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_20px_40px_rgba(0,0,0,0.5)] text-slate-100',
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';
