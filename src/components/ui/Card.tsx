import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'bordered' | 'interactive' | 'glass';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'elevated', children, ...props }, ref) => {
    const baseStyles = 'rounded-2xl p-6 transition-all duration-200';
    
    const variants = {
      elevated: 'bg-slate-50 backdrop-blur-sm border border-slate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] text-slate-900',
      bordered: 'bg-transparent border border-slate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] text-slate-900',
      interactive: 'bg-slate-50 backdrop-blur-sm border border-slate-200 hover:border-slate-300 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_12px_40px_rgba(0,0,0,0.6)] cursor-pointer text-slate-900 transform hover:-translate-y-1 transition-all duration-300',
      glass: 'bg-slate-50 backdrop-blur-sm border border-slate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_20px_40px_rgba(0,0,0,0.5)] text-slate-900',
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

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 pb-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight text-slate-900 text-lg', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-slate-400 mt-1', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center pt-4 border-t border-slate-200 mt-4', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';


