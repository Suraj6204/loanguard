'use client';

import { useState, useEffect } from 'react';
import { operationsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

export default function SalesPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    try {
      const res = await operationsAPI.getSalesLeads();
      setLeads(res.data.data || []);
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      NOT_STARTED: 'bg-surface-100 text-surface-500',
      PENDING_DOCUMENT: 'bg-warning-100 text-warning-600',
      DOCUMENT_UPLOADED: 'bg-primary-100 text-primary-600',
      APPLIED: 'bg-accent-100 text-accent-600',
      SANCTIONED: 'bg-primary-100 text-primary-600',
      REJECTED: 'bg-danger-100 text-danger-600',
      DISBURSED: 'bg-accent-100 text-accent-600',
      CLOSED: 'bg-surface-200 text-surface-600',
    };
    return <span className={`badge ${styles[status] || styles.NOT_STARTED}`}>{status.replace('_', ' ')}</span>;
  };

  const stats = {
    total: leads.length,
    profileDone: leads.filter(l => l.profileCompleted).length,
    notStarted: leads.filter(l => l.applicationStatus === 'NOT_STARTED').length,
    pendingDoc: leads.filter(l => l.applicationStatus === 'PENDING_DOCUMENT').length,
    applied: leads.filter(l => l.applicationStatus === 'APPLIED').length,
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Sales Dashboard</h1>
        <p className="page-subtitle">Track registered borrowers and their application progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Leads', value: stats.total, bg: 'bg-primary-100', color: 'text-primary-600', icon: '👥' },
          { label: 'Profile Complete', value: stats.profileDone, bg: 'bg-accent-100', color: 'text-accent-600', icon: '✅' },
          { label: 'Not Started', value: stats.notStarted, bg: 'bg-surface-100', color: 'text-surface-600', icon: '👤' },
          { label: 'Pending Doc', value: stats.pendingDoc, bg: 'bg-warning-100', color: 'text-warning-600', icon: '⏳' },
          { label: 'Applied', value: stats.applied, bg: 'bg-primary-100', color: 'text-primary-600', icon: '📋' },
        ].map(s => (
          <div key={s.label} className="stat-card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${s.bg} ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-surface-900">{s.value}</p>
              <p className="text-[11px] text-surface-500 uppercase font-semibold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="skeleton h-64 rounded-2xl" />
      ) : (
        <div className="table-container bg-white">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Profile</th>
                <th>Application</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead: any) => (
                <tr key={lead._id}>
                  <td className="font-medium">{lead.name}</td>
                  <td className="text-surface-500">{lead.email}</td>
                  <td>{lead.profileCompleted ? <span className="text-accent-600 text-xs font-semibold">✓ Complete</span> : <span className="text-warning-500 text-xs">Incomplete</span>}</td>
                  <td>{statusBadge(lead.applicationStatus)}</td>
                  <td className="text-surface-400 text-xs">{formatDate(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
