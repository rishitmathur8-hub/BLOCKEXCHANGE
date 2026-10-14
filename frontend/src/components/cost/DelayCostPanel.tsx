import React, { useState, useEffect } from 'react';
import { BlockItem, SlotOption } from '@/types';
import { api } from '@/api/client';
import { fmtMinutes, formatDuration } from '@/utils/time';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  Clock,
  Train,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

interface DelayCostPanelProps {
  blocks: BlockItem[];
  initialBlockId?: number;
}

export const DelayCostPanel: React.FC<DelayCostPanelProps> = ({
  blocks,
  initialBlockId,
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<number>(
    initialBlockId || (blocks.length > 0 ? blocks[0].id : 1)
  );
  const [options, setOptions] = useState<SlotOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);

  useEffect(() => {
    if (!selectedBlockId) return;
    setLoading(true);
    setError(null);
    api
      .getBlockOptions(selectedBlockId)
      .then((data) => {
        setOptions(data);
        const recIndex = data.findIndex((o) => o.recommended);
        setSelectedOptionIndex(recIndex >= 0 ? recIndex : 0);
      })
      .catch((err) => {
        setError(err.message || 'Failed to calculate delay cost options for this block.');
      })
      .finally(() => setLoading(false));
  }, [selectedBlockId]);

  const currentOption = options[selectedOptionIndex] || null;
  const currentBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="space-y-6">
      {/* Header & Block Selector */}
      <div className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              Timetable Delay Cost Evaluation
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-semibold border border-blue-500/20">
              Backend Model
            </span>
          </div>
          <h2 className="text-xl font-condensed font-bold text-white tracking-wide">
            Train-Delay Cost Panel: Candidate Slot Optimization
          </h2>
          <p className="text-xs text-slate-400">
            Per-candidate start time analysis stepped at 15-minute intervals. Cost = &Sigma;(train weight &times; delay minutes).
          </p>

        </div>

        {/* Block Selector */}
        <div className="flex items-center gap-2 bg-railway-850 border border-railway-700 rounded-xl px-3 py-1.5 text-xs">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-slate-400 font-semibold">Inspect Block:</span>
          <select
            value={selectedBlockId}
            onChange={(e) => setSelectedBlockId(Number(e.target.value))}
            className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
          >
            {blocks.map((b) => (
              <option key={b.id} value={b.id} className="bg-railway-900 text-slate-100">
                Block #{b.id} ({fmtMinutes(b.start)}–{fmtMinutes(b.end)}) - {b.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <LoadingState message="Computing Train-Delay Cost Curve..." subMessage="Evaluating timetable passages across all freight, passenger, and express trains." />}

      {error && <ErrorState message={error} onRetry={() => setSelectedBlockId(selectedBlockId)} />}

      {!loading && !error && options.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-railway-900 border border-railway-800 text-slate-400 text-xs">
          No feasible slot options available for this block within its allowed window.
        </div>
      )}

      {!loading && !error && options.length > 0 && (
        <div className="space-y-6">
          {/* Comparison Curve Chart */}
          <div className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-blue-400" />
                  Train-Delay Cost Curve Across Allowed Windows
                </h3>
                <p className="text-xs text-slate-400">
                  Valleys in the curve indicate ideal low-density corridor windows with minimal disruption.
                </p>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {options.length} Candidate Slots Evaluated
              </div>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={options} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c3360" opacity={0.5} />
                  <XAxis dataKey="start_hhmm" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0b1528',
                      borderColor: '#1e3a68',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="delay_minutes"
                    name="Delay (Minutes)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={{ fill: '#38bdf8', r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    name="Weighted Delay Cost"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stepping Options Table & Train Detail Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Options Table */}
            <div className="lg:col-span-2 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl overflow-hidden">
              <div className="p-4 border-b border-railway-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Candidate Slot Options (15m Steps)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Click any slot row to view the impacted trains list
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-railway-850 text-slate-400 text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-railway-800">
                    <tr>
                      <th className="py-2.5 px-3">Start (IST)</th>
                      <th className="py-2.5 px-3">End (IST)</th>
                      <th className="py-2.5 px-3">Delay Minutes</th>
                      <th className="py-2.5 px-3">Weighted Cost</th>
                      <th className="py-2.5 px-3">Trains Hit</th>
                      <th className="py-2.5 px-3 text-right">Advisory Tag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-railway-800 font-mono">
                    {options.map((opt, idx) => {
                      const isSelected = selectedOptionIndex === idx;
                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedOptionIndex(idx)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-600/20 border-l-4 border-blue-500'
                              : 'hover:bg-railway-850/60'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-white">
                            {opt.start_hhmm}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {opt.end_hhmm}
                          </td>
                          <td className="py-2.5 px-3 text-sky-400">
                            {opt.delay_minutes}m
                          </td>
                          <td className="py-2.5 px-3 text-amber-400 font-bold">
                            {opt.cost}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200">
                            {opt.trains_hit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {opt.recommended ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <Sparkles className="w-3 h-3" />
                                Recommended
                              </span>
                            ) : isSelected ? (
                              <span className="text-[10px] text-blue-400 font-sans font-semibold">
                                Selected
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Option Detail: Impacted Trains List */}
            <div className="rounded-2xl bg-railway-900 border border-railway-750 shadow-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-railway-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Train className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">
                      Impacted Trains ({currentOption ? currentOption.affected.length : 0})
                    </h4>
                  </div>
                  {currentOption && (
                    <span className="font-mono text-xs font-bold text-blue-400">
                      Slot {currentOption.start_hhmm}–{currentOption.end_hhmm}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mt-3 max-h-72 overflow-y-auto pr-1">
                  {currentOption && currentOption.affected.length > 0 ? (
                    currentOption.affected.map((t, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-railway-950 border border-railway-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white">
                              Train #{t.train}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-railway-800 text-slate-300">
                              {t.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Corridor passage halted until track release
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-rose-400 block">
                            +{t.delay_min}m
                          </span>
                          <span className="text-[10px] text-slate-500">delay</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400 rounded-xl bg-railway-950/40">
                      No trains delayed during this window! Corridor is completely free.
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-railway-850 border border-railway-800 text-[11px] text-slate-400 italic space-y-1">
                <div className="flex items-center gap-1 font-semibold text-slate-300 not-italic">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                  <span>Model Assumption Disclaimer:</span>
                </div>
                <p>
                  Delay values are mathematical planning estimates from the backend's conservative waiting model (+20m setup buffer). Section controller makes the final call.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
