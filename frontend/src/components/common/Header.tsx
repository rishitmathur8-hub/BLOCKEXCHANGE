import React, { useState, useEffect } from 'react';
import { RefreshCw, UserCheck, Wifi, WifiOff, CloudUpload, Bell } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { UserRole } from '@/types';
import { getOfflineQueue } from '@/utils/offlineQueue';
import { api } from '@/api/client';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
}

const ROLES: UserRole[] = [
  'Section Controller',
  'Field Supervisor',
  'Engineering Officer',
  'S&T Officer',
  'Electrical (OHE) Officer',
];

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isRefreshing = false,
  lastUpdated,
}) => {
  const { role, userName, setRole } = useRole();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkQueue = () => {
      setOfflineCount(getOfflineQueue().length);
    };
    checkQueue();
    const interval = setInterval(checkQueue, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSyncOffline = async () => {
    setSyncing(true);
    try {
      await api.syncOfflineQueue();
      setOfflineCount(getOfflineQueue().length);
      onRefresh?.();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="bg-railway-900/90 backdrop-blur border-b border-railway-750 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-railway-800 border border-blue-400/30 flex items-center justify-center shadow-inner">
          <span className="font-condensed font-bold text-xl tracking-wider text-white">IR</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              Indian Railways Operating Department
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-condensed font-bold text-white tracking-wide flex items-center gap-2">
            Block Exchange
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-sans font-normal border border-blue-500/30">
              Northern Zone
            </span>
          </h1>
        </div>
      </div>

      {/* Right Controls: Role Switcher, Online/Offline, Sync Queue, Refresh */}
      <div className="flex items-center flex-wrap gap-2 sm:gap-3">
        {/* Offline Queue Badge */}
        {offlineCount > 0 && (
          <button
            onClick={handleSyncOffline}
            disabled={syncing || !isOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-medium transition"
            title="Click to sync offline actions"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
            <span>{offlineCount} Queued Offline</span>
          </button>
        )}

        {/* Live Network Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-railway-850 border border-railway-750 text-xs text-slate-300">
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-mono hidden sm:inline">API Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] font-mono text-rose-300">Offline</span>
            </>
          )}
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-2 bg-railway-850 border border-railway-700/80 rounded-lg px-2.5 py-1 text-xs">
          <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex flex-col">
            <label htmlFor="role-select" className="text-[10px] text-slate-400 uppercase font-semibold">
              Operating Role
            </label>
            <select
              id="role-select"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer pr-1"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="bg-railway-900 text-slate-100">
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-railway-800 hover:bg-railway-750 border border-railway-650 text-slate-200 text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
          title="Refresh All Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
};
