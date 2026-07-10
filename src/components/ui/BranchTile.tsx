import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Badge } from './Badge';
import { MapPin, Users, AlertCircle, Clock, CheckCircle } from 'lucide-react';

export interface BranchTileProps {
  branchId: string;
  name: string;
  code: string;
  address?: string;
  staffCount: number;
  onlineCount: number;
  lateCount?: number;
  alertCount?: number;
  isActive?: boolean;
  onClick?: () => void;
}

/**
 * Specialized dashboard card for store status (Spec P25).
 * Displays store name, live online check-ins, punctuality rate, and active alert indicators.
 */
export const BranchTile: React.FC<BranchTileProps> = ({
  name,
  code,
  address,
  staffCount,
  onlineCount,
  lateCount = 0,
  alertCount = 0,
  isActive = true,
  onClick,
}) => {
  const attendanceRate = staffCount > 0 ? Math.round(((onlineCount + lateCount) / staffCount) * 100) : 0;

  return (
    <Card
      variant="interactive"
      onClick={onClick}
      className={cn(
        'relative overflow-hidden group flex flex-col justify-between border-[#0a3a1e] bg-[#010e05]',
        alertCount > 0 && 'border-rose-500/40 shadow-lg shadow-rose-900/10'
      )}
    >
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#004417]/10 rounded-full blur-2xl group-hover:bg-[#004417]/20 transition-all pointer-events-none" />

      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold text-[#004417] bg-[#021a0a] border border-[#004417]/30 px-2 py-0.5 rounded-md tracking-wider">
                {code}
              </span>
              <Badge status={isActive ? 'active' : 'inactive'} />
            </div>
            <h3 className="text-lg font-bold text-white mt-2 group-hover:text-[#004417] transition-colors">
              {name}
            </h3>
          </div>

          {alertCount > 0 && (
            <div className="flex items-center space-x-1 bg-rose-950/80 border border-rose-500/50 text-rose-300 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse shadow-md shadow-rose-950">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{alertCount} Alert{alertCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {address && (
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-4 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{address}</span>
          </div>
        )}
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#0a3a1e] text-center relative z-10">
        <div className="bg-[#021a0a] p-2 rounded-xl border border-[#0a3a1e]">
          <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-0.5">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-sm font-extrabold">{onlineCount}</span>
          </div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Present</p>
        </div>

        <div className="bg-[#021a0a] p-2 rounded-xl border border-[#0a3a1e]">
          <div className="flex items-center justify-center space-x-1 text-amber-400 mb-0.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-sm font-extrabold">{lateCount}</span>
          </div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Late</p>
        </div>

        <div className="bg-[#021a0a] p-2 rounded-xl border border-[#0a3a1e]">
          <div className="flex items-center justify-center space-x-1 text-[#004417] mb-0.5">
            <Users className="w-3.5 h-3.5" />
            <span className="text-sm font-extrabold">{attendanceRate}%</span>
          </div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Rate</p>
        </div>
      </div>

      {/* Footer Staff info */}
      <div className="mt-3 text-right">
        <span className="text-[11px] text-slate-500 font-medium">
          Total Store Staff: <strong className="text-slate-300">{staffCount}</strong>
        </span>
      </div>
    </Card>
  );
};

