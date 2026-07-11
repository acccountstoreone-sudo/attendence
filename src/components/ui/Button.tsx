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
      primary: 'bg-[#1dbf73] hover:bg-[#18a864] text-white shadow-[0_4px_14px_rgba(29,191,115,0.35)] border border-[#16965a] focus:ring-[#1dbf73]',
      secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-sm focus:ring-slate-300',
      danger: 'bg-red-600 hover:bg-red-500 text-white shadow-sm border border-red-700 focus:ring-red-500',
      outline: 'border border-slate-200 bg-transparent hover:bg-slate-100 hover:border-slate-300 text-slate-700 hover:text-slate-900 focus:ring-slate-300',
      ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-200',
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

