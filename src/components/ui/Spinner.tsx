import React from 'react';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  label = 'Loading Anchor Fashion Portal...',
}) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-3 p-4', className)}>
      <div className="relative flex items-center justify-center">
        {/* Outer Spinning Ring */}
        <div
          className={cn(
            'rounded-full border-4 border-slate-200 border-t-blue-500 border-r-indigo-500 animate-spin shadow-lg shadow-blue-500/20',
            sizes[size]
          )}
        />
        {/* Inner Branded Shield */}
        <div className="absolute inset-0 flex items-center justify-center text-blue-400">
          <Shield className={cn(iconSizes[size], 'animate-pulse')} />
        </div>
      </div>
      {label && <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase animate-pulse">{label}</p>}
    </div>
  );
};

