import React, { useState } from 'react';
import { Train } from '@/types';
import { fmtMinutes, formatDuration } from '@/utils/time';
import { Train as TrainIcon, Filter } from 'lucide-react';

interface TrainsTableProps {
  trains: Train[];
}

export const TrainsTable: React.FC<TrainsTableProps> = ({ trains }) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filteredTrains = trains.filter((t) => {
    if (filterCategory === 'ALL') return true;
    return t.category.toLowerCase() === filterCategory.toLowerCase();
  });

  const categoryBadge = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'rajdhani':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/40">Rajdhani (Priority 5)</span>;
      case 'express':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">Express (Priority 3)</span>;
      case 'passenger':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">Passenger (Priority 2)</span>;
      case 'freight':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-600/40 text-slate-300 border border-slate-500/40">Freight (Priority 1)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{cat}</span>;
    }
  };

  return (
    <div className="rounded-2xl bg-railway-900 border border-railway-750 shadow-xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-railway-800 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-condensed font-bold text-white tracking-wide flex items-center gap-2">
            Section Train Movements
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-sans font-semibold">
              {trains.length} Active Trains
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Timetable corridor passage and priority weighting used in delay-cost evaluations
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 text-xs">
          {['ALL', 'Rajdhani', 'Express', 'Passenger', 'Freight'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                filterCategory === cat
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-railway-850 hover:bg-railway-800 text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-railway-850 text-slate-400 text-[11px] uppercase tracking-wider border-b border-railway-800 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4">Train No.</th>
              <th className="py-3 px-4">Category & Priority</th>
              <th className="py-3 px-4">Enters Section (IST)</th>
              <th className="py-3 px-4">Exits Section (IST)</th>
              <th className="py-3 px-4">Running Duration</th>
              <th className="py-3 px-4">Delay Multiplier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-railway-800">
            {filteredTrains.map((t) => {
              const runDuration = t.exit_time - t.entry_time;
              return (
                <tr key={t.id} className="hover:bg-railway-850/60 transition">
                  <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
                    <TrainIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{t.number}</span>
                  </td>
                  <td className="py-3 px-4">{categoryBadge(t.category)}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                    {fmtMinutes(t.entry_time)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {fmtMinutes(t.exit_time)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {formatDuration(runDuration)}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-amber-400">
                    {t.weight}x
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
