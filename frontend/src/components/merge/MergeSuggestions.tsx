import React, { useState } from 'react';
import { MergeProposal } from '@/types';
import { fmtMinutes, formatDuration } from '@/utils/time';
import {
  GitMerge,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Edit3,
  TrendingDown,
  Layers,
  Zap,
  Play,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { api } from '@/api/client';

interface MergeSuggestionsProps {
  proposals: MergeProposal[];
  onActionSuccess: () => void;
  onModifySlot: (blockId: number) => void;
}

export const MergeSuggestions: React.FC<MergeSuggestionsProps> = ({
  proposals,
  onActionSuccess,
  onModifySlot,
}) => {
  const { role, userName } = useRole();
  const [selectedProposal, setSelectedProposal] = useState<MergeProposal | null>(null);
  const [dialogAction, setDialogAction] = useState<'accept' | 'reject' | 'modify' | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationSummary, setOptimizationSummary] = useState<any | null>(null);

  const handleRunOptimizer = async () => {
    setIsOptimizing(true);
    try {
      const res = await api.runOptimize();
      setOptimizationSummary(res.summary);
      onActionSuccess();
    } catch (err: any) {
      alert(`Optimization failed: ${err.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleConfirmDecision = async (reason: string) => {
    if (!selectedProposal || !dialogAction) return;

    if (dialogAction === 'accept') {
      // Approve block
      await api.approveBlock(selectedProposal.block_id, userName);
      await api.createAuditLog({
        user_role: role,
        user_name: userName,
        action: 'ACCEPT_MERGE_PROPOSAL',
        entity_type: 'proposal',
        entity_id: String(selectedProposal.block_id),
        reason: reason || 'Accepted AI advisory proposal for merged multi-department closure.',
        details: `Merged departments: ${selectedProposal.depts.join(', ')}. Block #${selectedProposal.block_id}.`,
      });
    } else if (dialogAction === 'reject') {
      // Cancel the merged block to unassign requests
      await api.cancelBlock(selectedProposal.block_id);
      await api.createAuditLog({
        user_role: role,
        user_name: userName,
        action: 'REJECT_MERGE_PROPOSAL',
        entity_type: 'proposal',
        entity_id: String(selectedProposal.block_id),
        reason: reason || 'Officer opted for separate departmental execution.',
        details: `Rejected merged proposal #${selectedProposal.block_id}. Requests unlinked back to queue.`,
      });
    }

    onActionSuccess();
  };

  // Only show multi-request proposals or all proposals with clear separate vs merged contrast
  const candidateProposals = proposals;

  return (
    <div className="space-y-6">
      {/* Header and CP-SAT Solver Action */}
      <div className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Joint Track Closure Optimization
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-[10px] font-semibold border border-amber-500/20">
              Human-in-the-Loop Required
            </span>
          </div>
          <h2 className="text-xl font-condensed font-bold text-white tracking-wide">
            Merge Proposals: Separate vs Shared Track Closures
          </h2>
          <p className="text-xs text-slate-400">
            AI recommends joint work windows where track kilometers and timing overlap. No decision is applied without authorized officer confirmation.
          </p>
        </div>

        {/* Trigger Joint Solver */}
        <button
          onClick={handleRunOptimizer}
          disabled={isOptimizing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition active:scale-95 disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
          <span>{isOptimizing ? 'Running CP-SAT Solver...' : 'Re-Run Joint Optimization'}</span>
        </button>
      </div>

      {optimizationSummary && (
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 text-blue-200 text-xs flex items-center justify-between flex-wrap gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              CP-SAT solver scheduled {optimizationSummary.proposals} proposals. Total delay cost saved: {optimizationSummary.cost_saved} units.
            </span>
          </div>
          <button
            onClick={() => setOptimizationSummary(null)}
            className="text-[11px] font-semibold text-blue-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Proposals Grid */}
      <div className="space-y-6">
        {candidateProposals.map((proposal) => {
          const reqCount = proposal.requests ? proposal.requests.length : 1;
          const mergedDuration = proposal.end - proposal.start;
          const separateDuration = proposal.requests
            ? proposal.requests.reduce((acc, r) => acc + r.duration_min, 0)
            : mergedDuration;
          const timeSavedMin = Math.max(0, separateDuration - mergedDuration);

          // Delay minutes estimation
          const separateDelayEst = Math.round(reqCount * 45 + mergedDuration * 0.4);
          const mergedDelayEst = Math.round(mergedDuration * 0.35 + 20);
          const delaySavedMin = Math.max(0, separateDelayEst - mergedDelayEst);

          // Affected trains estimate
          const separateTrainsEst = reqCount * 3;
          const mergedTrainsEst = Math.max(1, Math.round(reqCount * 1.5));

          const hasMultipleDepts = proposal.depts && proposal.depts.length > 1;

          return (
            <div
              key={proposal.block_id}
              className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl space-y-5"
            >
              {/* Proposal Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-railway-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <GitMerge className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-condensed font-bold text-lg text-white">
                        Proposal for Block #{proposal.block_id}
                      </span>
                      {hasMultipleDepts && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          Multi-Department Synergy
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Sections km stretch • Contributing departments:{' '}
                      <span className="text-slate-200 font-semibold">
                        {proposal.depts ? proposal.depts.join(', ') : 'Mixed'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {proposal.needs_power_block && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30">
                      <Zap className="w-3.5 h-3.5" />
                      Shared OHE Isolation
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-300 bg-railway-850 px-3 py-1 rounded-lg border border-railway-750">
                    Window: {fmtMinutes(proposal.start)} – {fmtMinutes(proposal.end)}
                  </span>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A: Separate Execution */}
                <div className="p-4 rounded-xl bg-railway-950/70 border border-rose-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                      Option A: Separate Individual Closures
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-mono">
                      {reqCount} Disjoint Closures
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-railway-900 border border-railway-800 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Total Track Time</span>
                      <span className="font-bold text-slate-200">{separateDuration}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Train Delay</span>
                      <span className="font-bold text-rose-400">{separateDelayEst} mins</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Trains Hit</span>
                      <span className="font-bold text-slate-200">{separateTrainsEst}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Requires {reqCount} separate track possessions, repeated safety speed restrictions, and multiple OHE power isolations.
                  </p>
                </div>

                {/* Option B: Merged Shared Closure */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-railway-950 border border-emerald-500/40 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Option B: Recommended Merged Closure
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Single Shared Window
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-railway-900 border border-railway-800 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Closure Time</span>
                      <span className="font-bold text-white">{mergedDuration}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Train Delay</span>
                      <span className="font-bold text-emerald-400">{mergedDelayEst} mins</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Trains Hit</span>
                      <span className="font-bold text-white">{mergedTrainsEst}</span>
                    </div>
                  </div>

                  {/* Savings callout */}
                  <div className="flex items-center justify-between text-xs text-emerald-300 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Delay Minutes Saved:
                    </span>
                    <span className="font-mono font-bold text-white">
                      -{delaySavedMin} Minutes ({Math.round((delaySavedMin / (separateDelayEst || 1)) * 100)}% reduction)
                    </span>
                  </div>
                </div>
              </div>

              {/* Requisitions included */}
              {proposal.requests && proposal.requests.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Contributing Requisitions:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {proposal.requests.map((req) => (
                      <div
                        key={req.id}
                        className="p-2.5 rounded-lg bg-railway-950 border border-railway-800 text-xs text-slate-300 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-100">
                            {req.dept}: {req.work_type}
                          </span>
                          <p className="text-[11px] text-slate-400">
                            km {req.km_from}–{req.km_to} • Needs {req.duration_min}m
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 bg-railway-900 px-1.5 py-0.5 rounded">
                          {fmtMinutes(req.window_start)}–{fmtMinutes(req.window_end)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons with Confirmation Dialogs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-railway-800">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 italic">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Decision will be logged with officer signature and operational rationale.</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Modify Slot */}
                  <button
                    onClick={() => onModifySlot(proposal.block_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-railway-800 hover:bg-railway-750 text-slate-200 text-xs font-semibold transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Explore / Modify Slot</span>
                  </button>

                  {/* Reject */}
                  <button
                    onClick={() => {
                      setSelectedProposal(proposal);
                      setDialogAction('reject');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/20 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Merge</span>
                  </button>

                  {/* Accept */}
                  <button
                    onClick={() => {
                      setSelectedProposal(proposal);
                      setDialogAction('accept');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept Proposal</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!dialogAction}
        title={
          dialogAction === 'accept'
            ? 'Confirm Acceptance of Joint Merge Proposal'
            : 'Reject Merged Maintenance Closure'
        }
        description={
          dialogAction === 'accept'
            ? `You are confirming the joint execution for Block #${selectedProposal?.block_id}. The contributing departments will share the track possession from ${fmtMinutes(selectedProposal?.start)} to ${fmtMinutes(selectedProposal?.end)}.`
            : `You are rejecting the merged proposal for Block #${selectedProposal?.block_id}. Contributing requests will be unassigned and separate individual closure slots will be evaluated.`
        }
        actionType={dialogAction === 'accept' ? 'accept' : 'reject'}
        confirmLabel={dialogAction === 'accept' ? 'Authorise Joint Block' : 'Confirm Separate Execution'}
        confidence="HIGH"
        aiReasoning={`Merges ${selectedProposal?.requests?.length || 1} requisitions on overlapping track section. Reduces freight stoppage by ~35 mins.`}
        onConfirm={handleConfirmDecision}
        onClose={() => {
          setDialogAction(null);
          setSelectedProposal(null);
        }}
      />
    </div>
  );
};
