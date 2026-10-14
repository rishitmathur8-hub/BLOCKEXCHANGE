import React, { useState, useEffect } from 'react';
import { AuditEntry } from '@/types';
import { api } from '@/api/client';
import { formatDateTime } from '@/utils/time';
import {
  FileText,
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle,
  XCircle,
  Play,
  Square,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const loadLogs = () => {
    setLoading(true);
    setError(null);
    api
      .getAuditLogs()
      .then((data) => setLogs(data))
      .catch((err) => setError(err.message || 'Failed to load audit trail.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.action.toUpperCase() === filterAction.toUpperCase();
    const matchesSearch =
      log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.reason && log.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAction && matchesSearch;
  });

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case 'APPROVE_BLOCK':
      case 'ACCEPT_MERGE_PROPOSAL':
      case 'ACCEPT_REPLAN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            {action.replace(/_/g, ' ')}
          </span>
        );
      case 'REJECT_MERGE_PROPOSAL':
      case 'REJECT_REPLAN':
      case 'CANCEL_BLOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            {action.replace(/_/g, ' ')}
          </span>
        );
      case 'START_WORK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Play className="w-3 h-3" />
            START WORK
          </span>
        );
      case 'END_WORK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Square className="w-3 h-3" />
            END WORK
          </span>
        );
      case 'CREATE_REQUEST':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <PlusCircle className="w-3 h-3" />
            CREATE REQUISITION
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-slate-300">
            {action.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Operator', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Reason', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.user_name}"`,
      `"${l.user_role}"`,
      `"${l.action}"`,
      `"${l.entity_type}"`,
      `"${l.entity_id}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `blockexchange_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              Statutory Governance & Compliance
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-semibold border border-blue-500/20">
              Tamper-Evident Trail
            </span>
          </div>
          <h2 className="text-xl font-condensed font-bold text-white tracking-wide">
            Operational Decision Audit Log
          </h2>
          <p className="text-xs text-slate-400">
            Immutable log of all human approvals, rejections, modifications, and field track possession check-ins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-railway-800 hover:bg-railway-750 text-slate-200 text-xs font-semibold border border-railway-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={loadLogs}
            className="p-2 rounded-xl bg-railway-800 hover:bg-railway-750 text-slate-200 transition"
            title="Refresh logs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-railway-900 border border-railway-750 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="flex items-center gap-2 bg-railway-950 border border-railway-750 px-3 py-1.5 rounded-xl w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by officer, entity #, keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-semibold text-[11px] uppercase mr-1">
            Filter Action:
          </span>
          {['ALL', 'APPROVE_BLOCK', 'REJECT_MERGE_PROPOSAL', 'START_WORK', 'END_WORK', 'CREATE_REQUEST', 'ACCEPT_REPLAN'].map((action) => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                filterAction === action
                  ? 'bg-blue-600 text-white'
                  : 'bg-railway-850 hover:bg-railway-800 text-slate-400'
              }`}
            >
              {action === 'ALL' ? 'ALL ACTIONS' : action.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingState message="Retrieving Audit Trail..." subMessage="Loading logged decisions and officer signatures." />}

      {error && <ErrorState message={error} onRetry={loadLogs} />}

      {!loading && !error && (
        <div className="rounded-2xl bg-railway-900 border border-railway-750 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-railway-850 text-slate-400 text-[11px] uppercase tracking-wider border-b border-railway-800 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-4">Authorised Officer</th>
                  <th className="py-3 px-4">Action Recorded</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Operational Rationale</th>
                  <th className="py-3 px-4">Context Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-railway-800 font-sans">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-railway-850/60 transition">
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-white block">{log.user_name}</span>
                      <span className="text-[10px] text-blue-400 font-medium">
                        {log.user_role}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="py-3 px-4 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-railway-800 text-slate-200 text-[10px] font-bold">
                        {log.entity_type.toUpperCase()} #{log.entity_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-medium max-w-xs">
                      {log.reason || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px] max-w-xs">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
