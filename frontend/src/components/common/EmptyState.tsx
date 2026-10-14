import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  message,
  action,
}) => {
  return (
    <div className="p-8 sm:p-12 text-center rounded-2xl bg-railway-900/30 border border-dashed border-railway-750 flex flex-col items-center">
      <div className="w-12 h-12 rounded-xl bg-railway-800 border border-railway-700 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm mb-4 leading-relaxed">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
