import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const AdvisoryBanner: React.FC = () => {
  return (
    <aside
      aria-label="Advisory Notice"
      className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-600/30 px-4 py-2 text-xs flex items-center justify-between text-amber-200/90 tracking-wide select-none shadow-sm"
    >
      <div className="flex items-center gap-2 mx-auto sm:mx-0">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
        <span className="font-semibold uppercase tracking-wider text-amber-300">
          Operational Advisory System:
        </span>
        <span className="text-amber-100/90 font-medium">
          Advisory only: final decision rests with the authorised officer.
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-2 text-slate-400 text-[11px] font-mono">
        <span>IR-BLOCKEXCHANGE v2.4</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
      </div>
    </aside>
  );
};
