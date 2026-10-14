import React, { useState, useEffect } from 'react';
import { BlockItem, BlockRequest, Section } from '@/types';
import { fmtMinutes, getNowMinute, formatDuration } from '@/utils/time';
import { Filter, Layers, Clock, Zap, MapPin, X, Info } from 'lucide-react';

interface BlockTimelineProps {
  sections: Section[];
  blocks: BlockItem[];
  requests: BlockRequest[];
  onSelectBlock?: (blockId: number) => void;
}

const DAY_MINUTES = 1440;

export const BlockTimeline: React.FC<BlockTimelineProps> = ({
  sections,
  blocks,
  requests,
  onSelectBlock,
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [activeItem, setActiveItem] = useState<{ type: 'block' | 'request'; item: any } | null>(null);
  const [nowMinute, setNowMinute] = useState(getNowMinute());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMinute(getNowMinute());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const sectionList =
    sections.length > 0
      ? sections
      : [
          {
            id: 1,
            name: 'Saharanpur-Ambala',
            from_station: 'Saharanpur',
            to_station: 'Ambala',
            length_km: 85.0,
          },
        ];

  // Filters
  const filteredRequests = requests.filter((r) => {
    if (selectedDept === 'ALL') return true;
    return r.dept.toLowerCase() === selectedDept.toLowerCase();
  });

  const filteredBlocks = blocks.filter((b) => {
    if (selectedDept === 'ALL') return true;
    if (!b.requests || b.requests.length === 0) return true;
    return b.requests.some((r) => r.dept.toLowerCase() === selectedDept.toLowerCase());
  });

  // Position percentage across 24h
  const pct = (min: number) => `${Math.max(0, Math.min(100, (min / DAY_MINUTES) * 100))}%`;
  const widthPct = (start: number, end: number) => `${Math.max(0.8, ((end - start) / DAY_MINUTES) * 100)}%`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed':
        return 'bg-amber-500/80 border-amber-400 text-amber-950';
      case 'approved':
        return 'bg-emerald-600 border-emerald-400 text-white';
      case 'started':
        return 'bg-sky-600 border-sky-400 text-white';
      case 'completed':
        return 'bg-slate-600 border-slate-500 text-slate-100';
      case 'overrun':
        return 'bg-rose-600 border-rose-400 text-white';
      case 'cancelled':
        return 'bg-slate-700/60 border-slate-600 text-slate-400';
      default:
        return 'bg-blue-600 border-blue-400 text-white';
    }
  };

  return (
    <div className="space-y-4">
      {/* Timeline Controls & Legend */}
      <div className="p-4 rounded-2xl bg-railway-900 border border-railway-750 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-condensed font-bold text-white tracking-wide flex items-center gap-2">
            24-Hour Corridor Possession Timeline (IST)
          </h3>
          <p className="text-xs text-slate-400">
            Interactive Gantt timeline by track section. Solid bars represent merged closures; dashed boxes represent permissible department windows.
          </p>
        </div>

        {/* Department Filter & Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs bg-railway-850 p-1 rounded-xl border border-railway-750">
            {['ALL', 'Engineering', 'S&T', 'OHE'].map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  selectedDept === dept
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="rounded-2xl bg-railway-900 border border-railway-750 shadow-xl overflow-hidden p-4">
        {/* Legend Swatches */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pb-3 border-b border-railway-800 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-400"></span>
            <span>Proposed Block</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-400"></span>
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-sky-600 border border-sky-400"></span>
            <span>Work Started</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-600 border border-slate-500"></span>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-600 border border-rose-400"></span>
            <span>Overrun</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-3.5 border-2 border-dashed border-slate-400 rounded"></span>
            <span>Open Requisition Window</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-white shadow-sm shadow-white"></span>
            <span className="text-white font-semibold">Live Time Marker</span>
          </div>
        </div>

        {/* Scrollable Timeline Area */}
        <div className="overflow-x-auto">
          <div className="min-w-[950px] relative select-none">
            {/* Hour Axis */}
            <div className="grid grid-cols-[140px_1fr] border-b border-railway-800 pb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Section Lane
              </span>
              <div className="relative h-6 text-[11px] font-mono text-slate-400">
                {Array.from({ length: 13 }).map((_, i) => {
                  const hour = i * 2;
                  const timeStr = `${String(hour).padStart(2, '0')}:00`;
                  const leftPos = (hour / 24) * 100;
                  return (
                    <span
                      key={hour}
                      style={{ left: `${leftPos}%` }}
                      className="absolute -translate-x-1/2 border-l border-railway-700/60 pl-1 h-4"
                    >
                      {timeStr}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Section Lanes */}
            <div className="divide-y divide-railway-800">
              {sectionList.map((sec) => {
                const secBlocks = filteredBlocks.filter((b) => b.section_id === sec.id);
                const secRequests = filteredRequests.filter((r) => r.section_id === sec.id);

                return (
                  <div key={sec.id} className="grid grid-cols-[140px_1fr] py-4 group hover:bg-railway-850/30 transition">
                    {/* Lane Header */}
                    <div className="pr-3 flex flex-col justify-center">
                      <span className="font-condensed font-bold text-sm text-white">
                        {sec.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {sec.from_station} ↔ {sec.to_station}
                      </span>
                      <span className="text-[10px] font-mono text-blue-400">
                        {sec.length_km} km
                      </span>
                    </div>

                    {/* Lane Track */}
                    <div className="relative h-20 rounded-xl bg-railway-950/60 border border-railway-800 overflow-hidden">
                      {/* Vertical Hour Grid Lines */}
                      {Array.from({ length: 24 }).map((_, h) => (
                        <div
                          key={h}
                          style={{ left: `${(h / 24) * 100}%` }}
                          className="absolute top-0 bottom-0 w-px bg-railway-800/40 pointer-events-none"
                        />
                      ))}

                      {/* Current Time Indicator Line */}
                      <div
                        style={{ left: pct(nowMinute) }}
                        className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-md shadow-white pointer-events-none"
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-white -ml-1 -top-1 absolute shadow-sm" />
                      </div>

                      {/* Open Request Windows (Dashed Boxes) */}
                      {secRequests.map((r) => (
                        <div
                          key={`req-${r.id}`}
                          onClick={() => setActiveItem({ type: 'request', item: r })}
                          style={{
                            left: pct(r.window_start),
                            width: widthPct(r.window_start, r.window_end),
                          }}
                          title={`Request #${r.id}: ${r.dept} (${r.work_type})\nWindow: ${fmtMinutes(r.window_start)}–${fmtMinutes(r.window_end)}\nRequired: ${r.duration_min}m\nStretch: km ${r.km_from}–${r.km_to}`}
                          className="absolute top-2 h-4 border-2 border-dashed border-amber-400/50 hover:border-amber-300 rounded cursor-pointer transition hover:bg-amber-400/10 z-10 flex items-center px-1"
                        >
                          <span className="text-[9px] font-mono font-bold text-amber-300/80 truncate">
                            {r.dept} #{r.id} ({r.duration_min}m)
                          </span>
                        </div>
                      ))}

                      {/* Maintenance Blocks (Solid Bars) */}
                      {secBlocks.map((b) => {
                        const depts = b.requests ? [...new Set(b.requests.map((r) => r.dept))] : [];
                        const isMerged = depts.length > 1;

                        return (
                          <div
                            key={`block-${b.id}`}
                            onClick={() => {
                              setActiveItem({ type: 'block', item: b });
                              onSelectBlock?.(b.id);
                            }}
                            style={{
                              left: pct(b.start),
                              width: widthPct(b.start, b.end),
                            }}
                            className={`absolute bottom-2 h-9 rounded-lg border shadow-md cursor-pointer transition hover:scale-[1.02] hover:z-30 px-2 flex items-center justify-between overflow-hidden ${getStatusColor(b.status)}`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-xs truncate">
                                Block #{b.id}
                              </span>
                              {isMerged && (
                                <span className="px-1 py-0.2 rounded bg-black/30 text-[9px] font-mono font-bold uppercase">
                                  {depts.join('+')}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-semibold opacity-90 shrink-0 ml-1">
                              {fmtMinutes(b.start)}–{fmtMinutes(b.end)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Drawer / Modal on item click */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-railway-900 border border-railway-750 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-railway-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    {activeItem.type === 'block'
                      ? `Block #${activeItem.item.id} Inspection`
                      : `Request #${activeItem.item.id} Details`}
                  </h4>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">
                    Corridor Asset Requisition
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-railway-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeItem.type === 'block' ? (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-railway-850 border border-railway-800 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Timetable Window</span>
                    <span className="font-bold text-white">
                      {fmtMinutes(activeItem.item.start)} – {fmtMinutes(activeItem.item.end)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Total Duration</span>
                    <span className="font-bold text-white">
                      {formatDuration(activeItem.item.end - activeItem.item.start)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Operational Status</span>
                    <span className="font-bold uppercase text-blue-400">{activeItem.item.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Overrun Recorded</span>
                    <span className="font-bold text-amber-400">{activeItem.item.overrun_min || 0} mins</span>
                  </div>
                </div>

                {activeItem.item.requests && activeItem.item.requests.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block mb-1.5">
                      Contributing Requisitions ({activeItem.item.requests.length})
                    </span>
                    <div className="space-y-1.5">
                      {activeItem.item.requests.map((r: BlockRequest) => (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-lg bg-railway-950 border border-railway-800 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-white">
                              {r.dept}: {r.work_type}
                            </span>
                            <p className="text-[11px] text-slate-400">
                              Track km {r.km_from}–{r.km_to} • Needs {r.duration_min}m
                            </p>
                          </div>
                          {r.needs_power_block && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Power Block
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-railway-850 border border-railway-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">
                      {activeItem.item.dept} Department
                    </span>
                    <span className="font-mono text-amber-400 font-bold">
                      {activeItem.item.duration_min} Minutes Required
                    </span>
                  </div>
                  <p className="text-slate-300">
                    Work Type: <span className="font-semibold text-white">{activeItem.item.work_type}</span>
                  </p>
                  <p className="font-mono text-slate-400">
                    Location: km {activeItem.item.km_from} to km {activeItem.item.km_to}
                  </p>
                  <p className="font-mono text-slate-400">
                    Permissible Window: {fmtMinutes(activeItem.item.window_start)} to {fmtMinutes(activeItem.item.window_end)}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveItem(null)}
                className="px-4 py-2 rounded-xl bg-railway-800 hover:bg-railway-750 text-slate-200 text-xs font-semibold transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
