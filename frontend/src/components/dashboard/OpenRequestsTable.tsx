import React from 'react';
import { BlockRequest } from '@/types';
import { fmtMinutes, formatDuration } from '@/utils/time';
import { Zap, GitMerge, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OpenRequestsTableProps {
  requests: BlockRequest[];
}

export const OpenRequestsTable: React.FC<OpenRequestsTableProps> = ({ requests }) => {
  const deptChip = (dept: string) => {
    switch (dept) {
      case 'Engineering':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">ENG</span>;
      case 'S&T':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">S&T</span>;
      case 'OHE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">OHE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">{dept}</span>;
    }
  };

  return (
    <div className="rounded-2xl bg-railway-900 border border-railway-750 shadow-xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-railway-800 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-condensed font-bold text-white tracking-wide flex items-center gap-2">
            Open Department Requests
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-sans font-semibold">
              {requests.length}
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Unassigned requests waiting for merge proposals or CP-SAT joint scheduling
          </p>
        </div>
        <Link
          to="/merge-suggestions"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold transition"
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>Review Merge Opportunities</span>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-railway-850 text-slate-400 text-[11px] uppercase tracking-wider border-b border-railway-800">
            <tr>
              <th className="py-3 px-4">Req #</th>
              <th className="py-3 px-4">Dept</th>
              <th className="py-3 px-4">Work Nature</th>
              <th className="py-3 px-4">Track Stretch</th>
              <th className="py-3 px-4">Required</th>
              <th className="py-3 px-4">Permissible Window</th>
              <th className="py-3 px-4">OHE Power Block</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-railway-800">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-railway-850/60 transition">
                <td className="py-3 px-4 font-mono font-bold text-white">#{r.id}</td>
                <td className="py-3 px-4">{deptChip(r.dept)}</td>
                <td className="py-3 px-4 font-medium text-slate-200">{r.work_type}</td>
                <td className="py-3 px-4 font-mono text-slate-300">
                  km {r.km_from} – {r.km_to}
                </td>
                <td className="py-3 px-4 font-mono text-slate-200">
                  {formatDuration(r.duration_min)}
                </td>
                <td className="py-3 px-4 font-mono text-slate-300">
                  {fmtMinutes(r.window_start)} – {fmtMinutes(r.window_end)}
                </td>
                <td className="py-3 px-4">
                  {r.needs_power_block ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-300">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      Required
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">Not required</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
