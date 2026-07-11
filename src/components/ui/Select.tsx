'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  labels: Record<string, string>;
  registerLabel: (val: string, label: string) => void;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});

  const registerLabel = (val: string, label: string) => {
    setLabels((prev) => (prev[val] === label ? prev : { ...prev, [val]: label }));
  };

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, labels, registerLabel }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = useContext(SelectContext);
    if (!ctx) throw new Error('SelectTrigger must be used within a Select');

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => ctx.setOpen(!ctx.open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1dbf73] disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('SelectValue must be used within a Select');

  const display = ctx.value ? ctx.labels[ctx.value] || ctx.value : placeholder;
  return <span className={cn('block truncate', !ctx.value && 'text-slate-500')}>{display}</span>;
};

export const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, _ref) => {
    const ctx = useContext(SelectContext);
    const contentRef = useRef<HTMLDivElement>(null);
    if (!ctx) throw new Error('SelectContent must be used within a Select');

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
          ctx.setOpen(false);
        }
      };
      if (ctx.open) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [ctx.open, ctx]);

    if (!ctx.open) return null;

    return (
      <div
        ref={contentRef}
        className={cn(
          'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-2xl backdrop-blur-sm focus:outline-none animate-in fade-in-80',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<HTMLDivElement, { value: string; children: React.ReactNode; className?: string }>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = useContext(SelectContext);
    if (!ctx) throw new Error('SelectItem must be used within a Select');

    useEffect(() => {
      if (typeof children === 'string') {
        ctx.registerLabel(value, children);
      } else if (React.isValidElement(children) || Array.isArray(children)) {
        ctx.registerLabel(value, value);
      }
    }, [value, children, ctx]);

    const isSelected = ctx.value === value;

    return (
      <div
        ref={ref}
        onClick={() => {
          ctx.onValueChange?.(value);
          ctx.setOpen(false);
        }}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 focus:bg-white/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors',
          isSelected && 'bg-white/10 text-[#1dbf73] font-medium',
          className
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <Check className="h-4 w-4" />}
        </span>
        <span className="truncate">{children}</span>
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

