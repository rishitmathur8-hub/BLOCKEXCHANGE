import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  GanttChartSquare,
  GitMerge,
  Clock,
  Smartphone,
  TrendingUp,
  FileText,
  TrainTrack,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  highlight?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/new-request', label: 'New Block Request', icon: PlusCircle, highlight: true },
  { to: '/timeline', label: 'Block Timeline', icon: GanttChartSquare },
  { to: '/merge-suggestions', label: 'Merge Suggestions', icon: GitMerge, badge: 'AI' },
  { to: '/delay-cost', label: 'Delay Cost Panel', icon: Clock },
  { to: '/field-staff', label: 'Field Staff View', icon: Smartphone, badge: 'Mobile' },
  { to: '/predictions', label: 'Overrun & Re-plan', icon: TrendingUp },
  { to: '/audit', label: 'Audit Log', icon: FileText },
];

export const Sidebar: React.FC = () => {
  const { role, userName } = useRole();

  return (
    <aside className="w-64 bg-railway-900 border-r border-railway-750 flex flex-col justify-between shrink-0 min-h-[calc(100vh-80px)]">
      <div className="p-3">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navigation & Windows
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : item.highlight
                      ? 'text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200'
                      : 'text-slate-300 hover:bg-railway-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.badge === 'AI'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-sky-400/20 text-sky-300 border border-sky-400/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User profile block */}
      <div className="p-4 m-3 rounded-xl bg-railway-850 border border-railway-750 text-xs text-slate-300 space-y-1">
        <div className="flex items-center gap-2 text-slate-400">
          <TrainTrack className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">Active Operator</span>
        </div>
        <p className="font-medium text-slate-100 truncate">{userName}</p>
        <p className="text-[11px] text-blue-400 font-medium">{role}</p>
      </div>
    </aside>
  );
};
