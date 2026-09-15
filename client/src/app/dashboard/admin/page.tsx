'use client';

import { useState, useEffect } from 'react';
import { operationsAPI } from '@/services/api';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      const res = await operationsAPI.getDashboard();
      setData(res.data.data);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header"><h1 className="page-title">Admin Dashboard</h1></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const cards = [
    { label: 'Total Applications', value: stats.totalApplications || 0, bg: 'bg-primary-100', color: 'text-primary-600', icon: '📊' },
    { label: 'Pending Review', value: stats.applied || 0, bg: 'bg-warning-100', color: 'text-warning-600', icon: '⏳' },
    { label: 'Sanctioned', value: stats.sanctioned || 0, bg: 'bg-primary-100', color: 'text-primary-600', icon: '✅' },
    { label: 'Rejected', value: stats.rejected || 0, bg: 'bg-danger-100', color: 'text-danger-600', icon: '❌' },
    { label: 'Disbursed', value: stats.disbursed || 0, bg: 'bg-accent-100', color: 'text-accent-600', icon: '💰' },
    { label: 'Closed', value: stats.closed || 0, bg: 'bg-surface-200', color: 'text-surface-600', icon: '🔒' },
    { label: 'Total Borrowers', value: data?.totalBorrowers || 0, bg: 'bg-primary-100', color: 'text-primary-600', icon: '👥' },
    { label: 'Total Outstanding', value: formatINR(stats.totalOutstanding || 0), bg: 'bg-danger-50', color: 'text-danger-600', icon: '💸', isString: true },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Consolidated overview of the loan management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className={`stat-icon ${c.bg} ${c.color}`}>{c.icon}</div>
            <div>
              <p className={`font-bold text-surface-900 ${c.isString ? 'text-lg' : 'text-2xl'}`}>{c.value}</p>
              <p className="text-xs text-surface-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Funnel Visualization */}
      <div className="card mb-8">
        <h3 className="font-semibold text-surface-800 mb-4">Loan Funnel</h3>
        <div className="space-y-3">
          {[
            { label: 'Applied', value: stats.applied || 0, max: stats.totalApplications || 1, color: 'bg-warning-400' },
            { label: 'Sanctioned', value: stats.sanctioned || 0, max: stats.totalApplications || 1, color: 'bg-primary-500' },
            { label: 'Disbursed', value: stats.disbursed || 0, max: stats.totalApplications || 1, color: 'bg-accent-500' },
            { label: 'Closed', value: stats.closed || 0, max: stats.totalApplications || 1, color: 'bg-surface-500' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
              <div className="h-4 bg-surface-100 rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full transition-all duration-700`}
                  style={{ width: `${Math.max((item.value / item.max) * 100, 2)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Payments */}
      {data?.recentPayments?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-surface-800 mb-4">Recent Payments</h3>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>UTR</th><th>Amount</th><th>Recorded By</th><th>Date</th></tr></thead>
              <tbody>
                {data.recentPayments.map((p: any) => (
                  <tr key={p._id}>
                    <td className="font-mono text-xs">{p.utrNumber}</td>
                    <td className="font-medium">{formatINR(p.amount)}</td>
                    <td>{p.recordedBy?.name || 'N/A'}</td>
                    <td className="text-xs text-surface-400">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
