import React, { useState } from 'react';
import { BlockItem } from '@/types';
import { fmtMinutes, formatDuration } from '@/utils/time';
import { Check, X, Eye, ShieldCheck, AlertCircle } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { api } from '@/api/client';

interface RecentBlocksTableProps {
  blocks: BlockItem[];
  onActionSuccess: () => void;
  onViewOptions: (blockId: number) => void;
}

export const RecentBlocksTable: React.FC<RecentBlocksTableProps> = ({
  blocks,
  onActionSuccess,
  onViewOptions,
}) => {
  const { role, userName } = useRole();
  const [selectedBlock, setSelectedBlock] = useState<BlockItem | null>(null);
  const [dialogAction, setDialogAction] = useState<'approve' | 'cancel' | null>(null);

  const isController = role === 'Section Controller';

  const handleApprove = async (reason: string) => {
    if (!selectedBlock) return;
    await api.approveBlock(selectedBlock.id, userName);
    await api.createAuditLog({
      user_role: role,
      user_name: userName,
      action: 'APPROVE_BLOCK',
      entity_type: 'block',
      entity_id: String(selectedBlock.id),
      reason: reason || 'Approved scheduled maintenance closure.',
      details: `Block #${selectedBlock.id} start: ${fmtMinutes(selectedBlock.start)}, end: ${fmtMinutes(selectedBlock.end)}`,
    });
    onActionSuccess();
  };

  const handleCancel = async (reason: string) => {
    if (!selectedBlock) return;
    await api.cancelBlock(selectedBlock.id);
    await api.createAuditLog({
      user_role: role,
      user_name: userName,
      action: 'CANCEL_BLOCK',
      entity_type: 'block',
      entity_id: String(selectedBlock.id),
      reason: reason || 'Cancelled by controller before track possession.',
      details: `Block #${selectedBlock.id} cancelled. Associated requests released back to pool.`,
    });
    onActionSuccess();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'proposed':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Proposed</span>;
      case 'approved':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Approved</span>;
      case 'started':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">Work Started</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-600/30 text-slate-300 border border-slate-500/30">Completed</span>;
      case 'overrun':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Overrun</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/40 text-slate-400 border border-slate-700">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="rounded-2xl bg-railway-900 border border-railway-750 shadow-xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-railway-800 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-condensed font-bold text-white tracking-wide flex items-center gap-2">
            Maintenance Blocks
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-sans font-semibold">
              {blocks.length}
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Unified track possessions, contributing departments, and status
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-railway-850 text-slate-400 text-[11px] uppercase tracking-wider border-b border-railway-800">
            <tr>
              <th className="py-3 px-4">Block #</th>
              <th className="py-3 px-4">Section</th>
              <th className="py-3 px-4">Window (IST)</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Contributing Requests</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-railway-800">
            {blocks.map((b) => (
              <tr key={b.id} className="hover:bg-railway-850/60 transition">
                <td className="py-3 px-4 font-mono font-bold text-white">#{b.id}</td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-slate-200">
                    {b.section_name || `Section ${b.section_id}`}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono font-medium text-slate-200">
                  {fmtMinutes(b.start)} – {fmtMinutes(b.end)}
                </td>
                <td className="py-3 px-4 font-mono">{formatDuration(b.end - b.start)}</td>
                <td className="py-3 px-4">{statusBadge(b.status)}</td>
                <td className="py-3 px-4">
                  {b.requests && b.requests.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {b.requests.map((r) => (
                        <span
                          key={r.id}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-railway-800 border border-railway-700 text-slate-300"
                        >
                          {r.dept}: {r.work_type} (km {r.km_from}–{r.km_to})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 font-mono">
                      {b.request_ids && b.request_ids.length
                        ? `Requests #${b.request_ids.join(', #')}`
                        : 'Single work slot'}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* View Options / Cost analysis */}
                    <button
                      onClick={() => onViewOptions(b.id)}
                      className="p-1.5 rounded-lg bg-railway-800 hover:bg-railway-700 text-slate-200 hover:text-white transition"
                      title="View train-delay cost options"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Approve button for controller */}
                    {b.status === 'proposed' && isController && (
                      <button
                        onClick={() => {
                          setSelectedBlock(b);
                          setDialogAction('approve');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow transition"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                    )}

                    {/* Cancel button */}
                    {['proposed', 'approved'].includes(b.status) && isController && (
                      <button
                        onClick={() => {
                          setSelectedBlock(b);
                          setDialogAction('cancel');
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition"
                        title="Cancel block"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!dialogAction}
        title={dialogAction === 'approve' ? 'Approve Maintenance Block' : 'Cancel Maintenance Block'}
        description={
          dialogAction === 'approve'
            ? `Confirm operational authorization for Block #${selectedBlock?.id} on ${selectedBlock?.section_name || 'Section'}. Work will be scheduled for execution.`
            : `Are you sure you want to cancel Block #${selectedBlock?.id}? All linked department requests will return to the unassigned queue.`
        }
        actionType={dialogAction === 'approve' ? 'approve' : 'cancel'}
        confirmLabel={dialogAction === 'approve' ? 'Authorise & Approve Block' : 'Confirm Cancellation'}
        onConfirm={dialogAction === 'approve' ? handleApprove : handleCancel}
        onClose={() => {
          setDialogAction(null);
          setSelectedBlock(null);
        }}
      />
    </div>
  );
};
