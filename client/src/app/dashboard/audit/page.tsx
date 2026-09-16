'use client';

import { useState, useEffect } from 'react';
import { operationsAPI } from '@/services/api';
import toast from 'react-hot-toast';

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-surface-200 text-surface-600',
  REGISTER: 'bg-primary-100 text-primary-600',
  APPLICATION_CREATED: 'bg-primary-100 text-primary-600',
  BRE_PASSED: 'bg-accent-100 text-accent-600',
  BRE_FAILED: 'bg-danger-100 text-danger-600',
  DOCUMENT_UPLOADED: 'bg-primary-100 text-primary-600',
  DOCUMENT_VALIDATED: 'bg-accent-100 text-accent-600',
  DOCUMENT_VALIDATION_FAILED: 'bg-danger-100 text-danger-600',
  LOAN_APPROVED: 'bg-accent-100 text-accent-600',
  LOAN_REJECTED: 'bg-danger-100 text-danger-600',
  LOAN_DISBURSED: 'bg-accent-100 text-accent-600',
  PAYMENT_RECORDED: 'bg-primary-100 text-primary-600',
  LOAN_CLOSED: 'bg-surface-200 text-surface-600',
  AUTHORIZATION_DENIED: 'bg-danger-100 text-danger-600',
  PROFILE_UPDATED: 'bg-primary-100 text-primary-600',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const limit = 20;

  useEffect(() => { fetchLogs(); }, [page, filterAction]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (filterAction) filters.action = filterAction;
      const res = await operationsAPI.getAuditLogs(page, limit, filters);
      setLogs(res.data.data?.logs || []);
      setTotal(res.data.data?.pagination?.total || 0);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const totalPages = Math.ceil(total / limit);

  const actions = [
    'LOGIN', 'REGISTER', 'PROFILE_UPDATED', 'APPLICATION_CREATED', 'BRE_PASSED', 'BRE_FAILED',
    'DOCUMENT_UPLOADED', 'DOCUMENT_VALIDATED', 'DOCUMENT_VALIDATION_FAILED',
    'LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_DISBURSED', 'PAYMENT_RECORDED', 'LOAN_CLOSED', 'AUTHORIZATION_DENIED',
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Complete audit trail of all system actions ({total} total)</p>
        </div>
        <select
          className="input w-auto"
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
        >
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <p className="text-surface-500">No audit logs found</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log: any) => (
              <div key={log._id} className="card py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className={`badge text-[10px] ${ACTION_COLORS[log.action] || 'bg-surface-100 text-surface-500'}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-700 truncate">
                      <span className="font-medium">{log.actorId?.name || 'System'}</span>
                      <span className="text-surface-400"> ({log.actorRole})</span>
                      {log.entityId && <span className="text-surface-400"> → {log.entityType} {String(log.entityId).slice(-6)}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-surface-400 whitespace-nowrap">{formatDate(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost btn-sm">← Prev</button>
              <span className="text-sm text-surface-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost btn-sm">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
