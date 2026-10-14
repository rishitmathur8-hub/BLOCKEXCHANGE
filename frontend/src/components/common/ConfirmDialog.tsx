import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useRole } from '@/context/RoleContext';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionType: 'accept' | 'reject' | 'modify' | 'approve' | 'cancel' | 'start' | 'end';
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  aiReasoning?: string;
  defaultReason?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
  confirmLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  actionType,
  confidence,
  aiReasoning,
  defaultReason = '',
  onConfirm,
  onClose,
  confirmLabel = 'Confirm Action',
}) => {
  const { role, userName } = useRole();
  const [reason, setReason] = useState(defaultReason);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionColors = {
    accept: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    approve: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    reject: 'bg-rose-600 hover:bg-rose-500 text-white',
    modify: 'bg-amber-600 hover:bg-amber-500 text-white',
    cancel: 'bg-rose-700 hover:bg-rose-600 text-white',
    start: 'bg-blue-600 hover:bg-blue-500 text-white',
    end: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-railway-900 border border-railway-750 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-railway-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">
                Authorised Officer Confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-railway-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{description}</p>

          {/* AI Reasoning & Confidence Badge */}
          {(confidence || aiReasoning) && (
            <div className="p-3.5 rounded-xl bg-railway-850 border border-blue-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Advisory System Assessment</span>
                </div>
                {confidence && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      confidence === 'HIGH'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : confidence === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                    }`}
                  >
                    {confidence} Confidence
                  </span>
                )}
              </div>
              {aiReasoning && (
                <p className="text-xs text-slate-300 font-mono bg-railway-950/60 p-2.5 rounded-lg border border-railway-800">
                  {aiReasoning}
                </p>
              )}
            </div>
          )}

          {/* Decision Maker Signature */}
          <div className="p-3 rounded-lg bg-railway-850/60 border border-railway-800 flex items-center justify-between text-xs text-slate-300">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Recording Decision For</span>
              <span className="font-semibold text-slate-100">{userName}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 text-[10px] font-semibold border border-blue-500/30">
              {role}
            </span>
          </div>

          {/* Decision Reason Input */}
          <div className="space-y-1.5">
            <label htmlFor="confirm-reason" className="block text-xs font-semibold text-slate-300">
              Officer Justification / Operational Reason:
            </label>
            <textarea
              id="confirm-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved joint window as track possession aligns with OHE isolation. Train disruption minimized."
              className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-400">
              This note will be permanently logged in the official railway audit trail.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-railway-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-railway-800 hover:bg-railway-750 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 ${actionColors[actionType]}`}
            >
              {isSubmitting ? 'Recording...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
