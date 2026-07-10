import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, icon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
    
    const variants = {
      primary: 'bg-gradient-to-b from-[#004417] to-[#006622] hover:from-[#00aa44] hover:to-[#006622] text-[#010e05] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_16px_rgba(210,160,42,0.2)] border border-[#006622] focus:ring-[#004417]',
      secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] focus:ring-white/20',
      danger: 'bg-gradient-to-b from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_8px_16px_rgba(220,38,38,0.2)] border border-rose-800 focus:ring-red-500',
      outline: 'border border-white/10 bg-transparent hover:bg-white/5 hover:border-white/20 text-slate-300 hover:text-white focus:ring-white/20',
      ghost: 'bg-transparent hover:bg-white/5 text-slate-400 hover:text-white focus:ring-white/10',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs space-x-1.5',
      md: 'px-4 py-2.5 text-sm space-x-2',
      lg: 'px-6 py-3.5 text-base space-x-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

