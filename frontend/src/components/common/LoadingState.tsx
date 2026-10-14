import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading Railway Data...',
  subMessage = 'Querying section tracks, schedules, and active blocks',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-railway-900/50 border border-railway-800">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
        <Loader2 className="w-6 h-6 text-blue-400 absolute inset-0 m-auto animate-pulse" />
      </div>
      <h3 className="text-base font-semibold text-slate-100">{message}</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">{subMessage}</p>
    </div>
  );
};
