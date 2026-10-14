import React, { useState, useEffect } from 'react';
import { BlockItem } from '@/types';
import { api } from '@/api/client';
import { fmtMinutes, getNowMinute, formatDuration } from '@/utils/time';
import {
  Smartphone,
  Play,
  Square,
  Clock,
  Wifi,
  WifiOff,
  CloudUpload,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { enqueueAction, getOfflineQueue } from '@/utils/offlineQueue';

interface FieldStaffViewProps {
  blocks: BlockItem[];
  onActionSuccess: () => void;
}

const OVERRUN_REASONS = [
  'material late',
  'crew shortage',
  'equipment failure',
  'unexpected defect',
  'permission delay',
  'machine breakdown',
  'weather conditions',
];

export const FieldStaffView: React.FC<FieldStaffViewProps> = ({
  blocks,
  onActionSuccess,
}) => {
  const { role, userName } = useRole();
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [selectedReasons, setSelectedReasons] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'warn'; msg: string } | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);

  // Field staff primarily acts on approved and started blocks
  const fieldBlocks = blocks.filter((b) =>
    ['approved', 'started', 'completed', 'overrun'].includes(b.status)
  );

  useEffect(() => {
    setOfflineCount(getOfflineQueue().length);
  }, []);

  const handleStartWork = async (block: BlockItem) => {
    setIsProcessing(block.id);
    const atMin = getNowMinute();
    const remark = remarks[block.id] || 'Track possession taken over with caution flags.';

    if (!navigator.onLine) {
      enqueueAction('START_BLOCK', block.id, { at_minute: atMin, remarks: remark });
      setOfflineCount(getOfflineQueue().length);
      setNotification({
        type: 'warn',
        msg: `Offline: 'Work Started' for Block #${block.id} queued locally. Will sync when connection is restored.`,
      });
      setIsProcessing(null);
      return;
    }

    try {
      await api.startBlock(block.id, atMin);
      await api.createAuditLog({
        user_role: role,
        user_name: userName,
        action: 'START_WORK',
        entity_type: 'block',
        entity_id: String(block.id),
        reason: remark,
        details: `Field work started at ${fmtMinutes(atMin)} IST. Possession active.`,
      });
      setNotification({
        type: 'success',
        msg: `Track possession active for Block #${block.id} at ${fmtMinutes(atMin)} IST.`,
      });
      onActionSuccess();
    } catch (err: any) {
      enqueueAction('START_BLOCK', block.id, { at_minute: atMin, remarks: remark });
      setOfflineCount(getOfflineQueue().length);
      setNotification({
        type: 'warn',
        msg: `Network dropped. Saved 'Work Started' to offline queue.`,
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleEndWork = async (block: BlockItem) => {
    setIsProcessing(block.id);
    const atMin = getNowMinute();
    const reason = selectedReasons[block.id] || undefined;
    const remark = remarks[block.id] || 'Track cleared and safe for traffic.';

    if (!navigator.onLine) {
      enqueueAction('END_BLOCK', block.id, {
        at_minute: atMin,
        overrun_reason: reason,
        remarks: remark,
      });
      setOfflineCount(getOfflineQueue().length);
      setNotification({
        type: 'warn',
        msg: `Offline: 'Work Ended' for Block #${block.id} queued locally. Will sync on reconnect.`,
      });
      setIsProcessing(null);
      return;
    }

    try {
      const res = await api.endBlock(block.id, atMin, reason);
      await api.createAuditLog({
        user_role: role,
        user_name: userName,
        action: 'END_WORK',
        entity_type: 'block',
        entity_id: String(block.id),
        reason: reason ? `Overrun reason: ${reason}. ${remark}` : remark,
        details: `Work finished at ${fmtMinutes(atMin)} IST. Final status: ${res.status}. Overrun: ${res.overrun_min} mins.`,
      });
      setNotification({
        type: 'success',
        msg: `Work ended for Block #${block.id}. Status: ${res.status.toUpperCase()} (${res.overrun_min}m overrun).`,
      });
      onActionSuccess();
    } catch (err: any) {
      enqueueAction('END_BLOCK', block.id, {
        at_minute: atMin,
        overrun_reason: reason,
        remarks: remark,
      });
      setOfflineCount(getOfflineQueue().length);
      setNotification({
        type: 'warn',
        msg: `Network error. Saved 'Work Ended' to offline queue.`,
      });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Mobile-first Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
              Field Execution Terminal
            </span>
            <h2 className="text-xl font-condensed font-bold text-white tracking-wide">
              Field Staff Track Possession
            </h2>
          </div>
        </div>

        {/* Offline indicator */}
        <div className="flex items-center gap-2">
          {navigator.onLine ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <Wifi className="w-3.5 h-3.5" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30 animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              Offline Queue
            </span>
          )}
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/50 border border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{notification.msg}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[10px] underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Blocks List */}
      <div className="space-y-4">
        {fieldBlocks.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-railway-900 border border-railway-800 text-slate-400 text-xs">
            No approved blocks currently assigned for field possession today.
          </div>
        ) : (
          fieldBlocks.map((block) => {
            const isStarted = block.status === 'started';
            const isApproved = block.status === 'approved';
            const isDone = ['completed', 'overrun'].includes(block.status);

            return (
              <div
                key={block.id}
                className={`p-5 rounded-2xl border shadow-xl transition space-y-4 ${
                  isStarted
                    ? 'bg-sky-950/30 border-sky-500/50 ring-1 ring-sky-500/30'
                    : isApproved
                    ? 'bg-railway-900 border-emerald-500/40'
                    : 'bg-railway-900/60 border-railway-800 opacity-80'
                }`}
              >
                {/* Block Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-condensed font-bold text-lg text-white">
                      Block #{block.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isStarted
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse'
                          : isApproved
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : block.status === 'overrun'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {block.status === 'started' ? 'Active Possession' : block.status}
                    </span>
                  </div>

                  <span className="font-mono text-xs text-slate-300 bg-railway-850 px-2.5 py-1 rounded-lg border border-railway-750">
                    Granted: {fmtMinutes(block.start)} – {fmtMinutes(block.end)} ({block.end - block.start}m)
                  </span>
                </div>

                {/* Section & Department Requisitions */}
                <div className="p-3 rounded-xl bg-railway-950/80 border border-railway-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-200">
                      {block.section_name || `Section ${block.section_id}`}
                    </span>
                    <span className="font-mono">
                      {block.requests ? `${block.requests.length} work items` : ''}
                    </span>
                  </div>
                  {block.requests && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {block.requests.map((r) => (
                        <span
                          key={r.id}
                          className="px-2 py-0.5 rounded text-[10px] bg-railway-900 border border-railway-750 text-slate-300 font-medium"
                        >
                          {r.dept}: {r.work_type} (km {r.km_from}–{r.km_to})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event Timestamps if available */}
                {block.event && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono p-2.5 rounded-lg bg-railway-850/60 border border-railway-800 text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Actual Start</span>
                      <span className="font-bold text-white">
                        {fmtMinutes(block.event.actual_start)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Actual Finish</span>
                      <span className="font-bold text-white">
                        {fmtMinutes(block.event.actual_end)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Large Tactile Action Buttons */}
                {isApproved && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Supervisor remarks (e.g. Caution flags placed at km 22)..."
                        value={remarks[block.id] || ''}
                        onChange={(e) =>
                          setRemarks({ ...remarks, [block.id]: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-railway-950 border border-railway-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      onClick={() => handleStartWork(block)}
                      disabled={isProcessing === block.id}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>
                        {isProcessing === block.id ? 'Recording Start...' : 'Work Started (Take Track Possession)'}
                      </span>
                    </button>
                  </div>
                )}

                {isStarted && (
                  <div className="space-y-3 pt-2">
                    {/* Overrun Reason Selector */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        If Delayed / Overrun, Select Operational Reason:
                      </label>
                      <select
                        value={selectedReasons[block.id] || ''}
                        onChange={(e) =>
                          setSelectedReasons({ ...selectedReasons, [block.id]: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">-- No Overrun / On Time Completion --</option>
                        {OVERRUN_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Remarks Input */}
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Completion remarks (e.g. Track cleared and inspected for 100 km/h speed)..."
                        value={remarks[block.id] || ''}
                        onChange={(e) =>
                          setRemarks({ ...remarks, [block.id]: e.target.value })
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-railway-950 border border-railway-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>

                    <button
                      onClick={() => handleEndWork(block)}
                      disabled={isProcessing === block.id}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-3 shadow-lg shadow-rose-600/30 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      <span>
                        {isProcessing === block.id ? 'Recording Completion...' : 'Work Ended (Hand Over Track Possession)'}
                      </span>
                    </button>
                  </div>
                )}

                {isDone && (
                  <div className="p-3 rounded-xl bg-railway-950/40 border border-railway-800/80 text-xs text-slate-400 flex items-center justify-between">
                    <span>Possession completed and handed back to section control.</span>
                    <span className="font-bold text-slate-200 font-mono">
                      Overrun: {block.overrun_min || 0}m
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
