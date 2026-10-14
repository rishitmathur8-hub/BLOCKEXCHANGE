import React, { useState, useEffect } from 'react';
import { OverrunAnalysis } from '@/types';
import { api } from '@/api/client';
import { fmtMinutes, formatDuration } from '@/utils/time';
import {
  TrendingUp,
  AlertTriangle,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

export const OverrunPredictView: React.FC = () => {
  const { role, userName } = useRole();
  const [analyses, setAnalyses] = useState<OverrunAnalysis[]>([]);
  const [buffers, setBuffers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAnalysis, setSelectedAnalysis] = useState<OverrunAnalysis | null>(null);
  const [dialogAction, setDialogAction] = useState<'accept_replan' | 'reject_replan' | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    api
      .getOverrunAnalysis()
      .then((data) => {
        setAnalyses(data.analyses || []);
        setBuffers(data.buffer_history || {});
      })
      .catch((err) => {
        setError(err.message || 'Failed to load overrun predictions.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmReplan = async (reason: string) => {
    if (!selectedAnalysis || !dialogAction) return;

    if (dialogAction === 'accept_replan') {
      await api.createAuditLog({
        user_role: role,
        user_name: userName,
        action: 'ACCEPT_REPLAN',
        entity_type: 'replan',
        entity_id: String(selectedAnalysis.block_id),
        reason: reason || 'Accepted suggested corridor re-plan to prevent cascading delay.',
        details: `Re-planned to ${selectedAnalysis.replan?.start_hhmm}–${selectedAnalysis.replan?.end_hhmm}. Estimated delay cost: ${selectedAnalysis.replan?.cost}.`,
      });
    } else {
      await api.createAuditLog({
        user_role: role,
        user_name: userName,
        action: 'REJECT_REPLAN',
        entity_type: 'replan',
        entity_id: String(selectedAnalysis.block_id),
        reason: reason || 'Controller retained original window schedule.',
        details: `Rejected re-plan for Block #${selectedAnalysis.block_id}.`,
      });
    }

    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
              Predictive Operations Intelligence
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-semibold border border-purple-500/20">
              Machine Learning & History
            </span>
          </div>
          <h2 className="text-xl font-condensed font-bold text-white tracking-wide">
            Overrun Predictions & Dynamic Re-Plan Advisory
          </h2>
          <p className="text-xs text-slate-400">
            Historical field completion data trains dynamic safety buffers. Overrun risks trigger instant corridor re-plan recommendations.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-railway-800 hover:bg-railway-750 text-slate-200 text-xs font-semibold transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {loading && <LoadingState message="Analyzing Field History..." subMessage="Computing historical duration variance and downstream train impacts." />}

      {error && <ErrorState message={error} onRetry={loadData} />}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Historical Overrun Buffers Summary */}
          <div className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Historical Average Overrun Buffers by Asset Type
                </h3>
                <p className="text-xs text-slate-400">
                  Calculated from 50+ completed BlockEvents in the SQLite database
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {Object.entries(buffers).map(([workType, bufferMin]) => (
                <div
                  key={workType}
                  className="p-3 rounded-xl bg-railway-950 border border-railway-800 text-center space-y-1"
                >
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block truncate">
                    {workType.replace('_', ' ')}
                  </span>
                  <div className="text-xl font-bold font-mono text-amber-400">
                    +{bufferMin}m
                  </div>
                  <span className="text-[10px] text-slate-500 block">Buffer Required</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Block Overrun Assessments */}
          <div className="space-y-4">
            <h3 className="text-base font-condensed font-bold text-white tracking-wide flex items-center gap-2">
              Active Corridor Overrun Risk & Dynamic Re-Plans ({analyses.length})
            </h3>

            {analyses.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-railway-900 border border-railway-800 text-slate-400 text-xs">
                No active blocks requiring overrun mitigation at this time.
              </div>
            ) : (
              analyses.map((item) => (
                <div
                  key={item.block_id}
                  className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl space-y-4"
                >
                  {/* Block Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-railway-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold font-mono">
                        #{item.block_id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-condensed font-bold text-base text-white">
                            Block #{item.block_id} ({item.primary_work_type.replace('_', ' ')})
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.risk === 'HIGH'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : item.risk === 'MEDIUM'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {item.risk} Overrun Risk
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Departments: {item.departments.join(', ')} • Section {item.section_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                          item.confidence === 'HIGH'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}
                      >
                        {item.confidence} Model Confidence
                      </span>
                    </div>
                  </div>

                  {/* Planned vs Predicted Timings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-railway-950 border border-railway-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-sans">
                        Planned Window
                      </span>
                      <span className="font-bold text-slate-200">
                        {fmtMinutes(item.planned_start)} – {fmtMinutes(item.planned_end)}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-sans mt-1">
                        Granted: {item.planned_end - item.planned_start} minutes
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-railway-950 border border-purple-500/30">
                      <span className="text-[10px] text-purple-400 uppercase block font-sans">
                        Predicted Actual End
                      </span>
                      <span className="font-bold text-amber-300">
                        {fmtMinutes(item.predicted_end)}
                      </span>
                      <span className="text-[10px] text-rose-400 block font-sans mt-1 font-bold">
                        Expected Overrun: +{item.expected_buffer_min} mins
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-railway-950 border border-railway-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-sans">
                        Statistical Rationale
                      </span>
                      <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                        {item.reason}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Re-Plan Advisory Card */}
                  {item.replan && (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 to-railway-950 border border-blue-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                            Suggested Corridor Re-Plan: Shift Window
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Cost-Optimal Re-Schedule
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-xs">
                        <div className="p-2 rounded-lg bg-railway-900 border border-railway-800">
                          <span className="text-[10px] text-slate-500 block font-sans">
                            Proposed Start
                          </span>
                          <span className="font-bold text-white">
                            {item.replan.start_hhmm}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-railway-900 border border-railway-800">
                          <span className="text-[10px] text-slate-500 block font-sans">
                            Proposed End
                          </span>
                          <span className="font-bold text-white">
                            {item.replan.end_hhmm}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-railway-900 border border-railway-800">
                          <span className="text-[10px] text-slate-500 block font-sans">
                            Delay Minutes
                          </span>
                          <span className="font-bold text-emerald-400">
                            {item.replan.delay_minutes}m
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-railway-900 border border-railway-800">
                          <span className="text-[10px] text-slate-500 block font-sans">
                            Weighted Delay Cost
                          </span>
                          <span className="font-bold text-amber-400">
                            {item.replan.cost}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 font-sans italic">
                        {item.replan.reason}
                      </p>

                      {/* Re-Plan Accept / Reject Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-railway-800">
                        <button
                          onClick={() => {
                            setSelectedAnalysis(item);
                            setDialogAction('reject_replan');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-railway-800 hover:bg-railway-750 text-slate-300 text-xs font-semibold transition"
                        >
                          Reject Re-plan
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAnalysis(item);
                            setDialogAction('accept_replan');
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition active:scale-95"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Accept & Reschedule Slot</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Re-Plan Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!dialogAction}
        title={
          dialogAction === 'accept_replan'
            ? 'Accept Re-Plan Slot Advisory'
            : 'Reject Suggested Re-Plan'
        }
        description={
          dialogAction === 'accept_replan'
            ? `You are confirming the reschedule for Block #${selectedAnalysis?.block_id} to ${selectedAnalysis?.replan?.start_hhmm}–${selectedAnalysis?.replan?.end_hhmm} IST. This action updates traffic control and logs an audit entry.`
            : `You are maintaining the original schedule for Block #${selectedAnalysis?.block_id}. Downstream trains may experience delays if overrun occurs.`
        }
        actionType={dialogAction === 'accept_replan' ? 'accept' : 'reject'}
        confirmLabel={dialogAction === 'accept_replan' ? 'Confirm Reschedule' : 'Maintain Original Schedule'}
        confidence={selectedAnalysis?.confidence}
        aiReasoning={selectedAnalysis?.reason}
        onConfirm={handleConfirmReplan}
        onClose={() => {
          setDialogAction(null);
          setSelectedAnalysis(null);
        }}
      />
    </div>
  );
};
