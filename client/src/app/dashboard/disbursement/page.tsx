'use client';

import { useState, useEffect } from 'react';
import { operationsAPI, loanAPI } from '@/services/api';
import toast from 'react-hot-toast';

export default function DisbursementPage() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'DISBURSED'>('PENDING');

  useEffect(() => { fetchLoans(); }, [activeTab]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const statusFilter = activeTab === 'PENDING' ? 'SANCTIONED' : 'DISBURSED';
      const res = await operationsAPI.getDisbursementQueue(1, 20, statusFilter);
      setLoans(res.data.data || []);
    } catch { toast.error('Failed to load loans'); }
    finally { setLoading(false); }
  };

  const handleDisburse = async (id: string) => {
    setActionLoading(id);
    try {
      await loanAPI.disburse(id);
      toast.success('Loan disbursed!');
      fetchLoans();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(''); }
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Disbursement Queue</h1>
          <p className="page-subtitle">Manage loan disbursements</p>
        </div>

        <div className="flex bg-surface-200 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'PENDING' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-600 hover:text-surface-900'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('DISBURSED')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'DISBURSED' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-600 hover:text-surface-900'}`}
          >
            Recently Disbursed
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : loans.length === 0 ? (
        <div className="empty-state">
          <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4 text-3xl">💰</div>
          <h3 className="text-lg font-semibold text-surface-700">
            {activeTab === 'PENDING' ? 'No loans to disburse' : 'No recent disbursements'}
          </h3>
          <p className="text-surface-500 text-sm">
            {activeTab === 'PENDING' ? 'No sanctioned loans pending disbursement' : 'No loans have been disbursed recently'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan: any) => (
            <div key={loan._id} className="card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-surface-900">{loan.borrowerId?.name || 'Unknown'}</h3>
                    <span className={activeTab === 'PENDING' ? 'badge-sanctioned' : 'badge-disbursed'}>
                      {activeTab === 'PENDING' ? 'SANCTIONED' : 'DISBURSED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-surface-500">Principal: </span><span className="font-medium">{formatINR(loan.principal)}</span></div>
                    <div><span className="text-surface-500">Repayment: </span><span className="font-medium">{formatINR(loan.totalRepayment)}</span></div>
                    <div>
                      <span className="text-surface-500">{activeTab === 'PENDING' ? 'Sanctioned: ' : 'Disbursed: '}</span>
                      <span className="font-medium">
                        {activeTab === 'PENDING'
                          ? (loan.sanctionedAt ? formatDate(loan.sanctionedAt) : 'N/A')
                          : (loan.disbursedAt ? formatDate(loan.disbursedAt) : 'N/A')
                        }
                      </span>
                    </div>
                  </div>
                </div>
                {activeTab === 'PENDING' && (
                  <button
                    onClick={() => handleDisburse(loan._id)}
                    disabled={actionLoading === loan._id}
                    className="btn-success shrink-0"
                  >
                    {actionLoading === loan._id ? 'Processing...' : '💰 Disburse'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
