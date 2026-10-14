import React from 'react';
import { Layers, AlertCircle, CheckCircle, ClockAlert, Sparkles, TrendingDown } from 'lucide-react';
import { BlockItem, BlockRequest, MergeProposal } from '@/types';

interface MetricsGridProps {
  blocks: BlockItem[];
  requests: BlockRequest[];
  proposals: MergeProposal[];
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ blocks, requests, proposals }) => {
  const completed = blocks.filter((b) => b.status === 'completed').length;
  const overruns = blocks.filter((b) => b.status === 'overrun').length;
  const activeCount = blocks.filter((b) => ['proposed', 'approved', 'started'].includes(b.status)).length;

  // Calculate estimated delay minutes saved by merging:
  // Each merged request group with >1 department saves approximately 35-50 train delay minutes
  const mergedProposals = proposals.filter((p) => p.requests && p.requests.length > 1);
  const estimatedDelaySavedMin = mergedProposals.length * 45;

  const cards = [
    {
      label: 'Total Blocks',
      value: blocks.length,
      subtext: `${activeCount} in active possession / proposed`,
      icon: Layers,
      color: 'blue',
      badge: 'All Statuses',
    },
    {
      label: 'Open Requests',
      value: requests.length,
      subtext: 'Awaiting merge or slot allocation',
      icon: AlertCircle,
      color: 'amber',
      badge: 'Unassigned',
    },
    {
      label: 'Completed On Time',
      value: completed,
      subtext: 'Successfully handed back to traffic',
      icon: CheckCircle,
      color: 'emerald',
      badge: 'Cleared',
    },
    {
      label: 'Overrun Incidents',
      value: overruns,
      subtext: 'Track possession exceeded window',
      icon: ClockAlert,
      color: 'rose',
      badge: 'Overrun',
    },
    {
      label: 'Train Delay Saved',
      value: `${estimatedDelaySavedMin}m`,
      subtext: `From ${mergedProposals.length} joint multi-dept closures`,
      icon: TrendingDown,
      color: 'purple',
      badge: 'Efficiency',
    },
  ];

  const colorStyles = {
    blue: 'border-blue-500/30 bg-gradient-to-br from-blue-950/40 to-railway-900 text-blue-400',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-railway-900 text-amber-400',
    emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-railway-900 text-emerald-400',
    rose: 'border-rose-500/30 bg-gradient-to-br from-rose-950/40 to-railway-900 text-rose-400',
    purple: 'border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-railway-900 text-purple-400',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={`p-4 rounded-2xl border shadow-lg flex flex-col justify-between transition hover:-translate-y-1 ${colorStyles[c.color as keyof typeof colorStyles]}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 tracking-wide">{c.label}</span>
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl font-condensed font-bold text-white tracking-tight">
                {c.value}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
              <span className="truncate pr-1">{c.subtext}</span>
              <span className="font-semibold px-1.5 py-0.5 rounded bg-white/10 text-white shrink-0 text-[10px]">
                {c.badge}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
