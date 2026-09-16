'use client';

import { useState, useEffect } from 'react';
import { operationsAPI, loanAPI } from '@/services/api';
import toast from 'react-hot-toast';

export default function CollectionPage() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<{ id: string; outstanding: number; show: boolean }>({ id: '', outstanding: 0, show: false });
  const [form, setForm] = useState({ utrNumber: '', amount: '', paymentDate: new Date().toISOString().split('T')[0] });
  const [actionLoading, setActionLoading] = useState(false);
  const [payments, setPayments] = useState<Record<string, any[]>>({});

  useEffect(() => { fetchLoans(); }, []);

  const fetchLoans = async () => {
    try {
      const res = await operationsAPI.getCollectionLoans();
      setLoans(res.data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const fetchPayments = async (loanId: string) => {
    try {
      const res = await loanAPI.getPayments(loanId);
      setPayments(prev => ({ ...prev, [loanId]: res.data.data.payments }));
    } catch { /* silent */ }
  };

  const handleRecordPayment = async () => {
    if (!form.utrNumber.trim()) { toast.error('UTR is required'); return; }
    const rawAmount = Number(form.amount.toString().replace(/,/g, ''));
    if (!form.amount || rawAmount <= 0) { toast.error('Amount must be positive'); return; }
    setActionLoading(true);
    try {
      const res = await loanAPI.recordPayment(paymentModal.id, {
        utrNumber: form.utrNumber.trim(),
        amount: rawAmount,
        paymentDate: form.paymentDate,
      });
      const msg = res.data.data.autoClose ? '🎉 Payment recorded! Loan is now CLOSED!' : 'Payment recorded successfully!';
      toast.success(msg);
      setPaymentModal({ id: '', outstanding: 0, show: false });
      setForm({ utrNumber: '', amount: '', paymentDate: new Date().toISOString().split('T')[0] });
      fetchLoans();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally { setActionLoading(false); }
  };

  const togglePayments = (loanId: string) => {
    if (payments[loanId]) {
      const newPayments = { ...payments };
      delete newPayments[loanId];
      setPayments(newPayments);
    } else {
      fetchPayments(loanId);
    }
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Collection Dashboard</h1>
        <p className="page-subtitle">Record payments for disbursed loans</p>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-2xl" />)}</div>
      ) : loans.length === 0 ? (
        <div className="empty-state">
          <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4 text-3xl">💳</div>
          <h3 className="text-lg font-semibold text-surface-700">No active loans</h3>
          <p className="text-surface-500 text-sm">No disbursed loans to collect payments for</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan: any) => {
            const paidPercent = loan.totalRepayment > 0 ? (loan.totalPaid / loan.totalRepayment) * 100 : 0;
            return (
              <div key={loan._id} className="card">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-surface-900">{loan.borrowerId?.name || 'Unknown'}</h3>
                      <span className="badge-disbursed">DISBURSED</span>
                    </div>

                    {/* Payment Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-surface-500 mb-1">
                        <span>Paid: {formatINR(loan.totalPaid)}</span>
                        <span>Total: {formatINR(loan.totalRepayment)}</span>
                      </div>
                      <div className="h-3 bg-surface-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(paidPercent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-accent-600 font-medium">{paidPercent.toFixed(1)}% paid</span>
                        <span className="text-danger-600 font-medium">Outstanding: {formatINR(loan.outstandingAmount)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-surface-500">Principal: </span><span className="font-medium">{formatINR(loan.principal)}</span></div>
                      <div><span className="text-surface-500">Interest: </span><span className="font-medium">{formatINR(loan.interestAmount)}</span></div>
                      <div><span className="text-surface-500">Disbursed: </span><span className="font-medium">{loan.disbursedAt ? formatDate(loan.disbursedAt) : 'N/A'}</span></div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setPaymentModal({ id: loan._id, outstanding: loan.outstandingAmount, show: true })}
                      className="btn-primary btn-sm"
                    >
                      💳 Record Payment
                    </button>
                    <button onClick={() => togglePayments(loan._id)} className="btn-ghost btn-sm">
                      {payments[loan._id] ? 'Hide History' : 'View History'}
                    </button>
                  </div>
                </div>

                {/* Payment History */}
                {payments[loan._id] && (
                  <div className="mt-4 pt-4 border-t border-surface-100 animate-fade-in">
                    <h4 className="text-sm font-semibold text-surface-600 mb-2">Payment History</h4>
                    {payments[loan._id].length === 0 ? (
                      <p className="text-sm text-surface-400">No payments recorded yet</p>
                    ) : (
                      <div className="table-container">
                        <table className="table">
                          <thead><tr><th>UTR</th><th>Amount</th><th>Date</th><th>Recorded By</th></tr></thead>
                          <tbody>
                            {payments[loan._id].map((p: any) => (
                              <tr key={p._id}>
                                <td className="font-mono text-xs">{p.utrNumber}</td>
                                <td className="font-medium">{formatINR(p.amount)}</td>
                                <td>{formatDate(p.paymentDate)}</td>
                                <td>{p.recordedBy?.name || 'System'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal.show && (
        <div className="modal-overlay" onClick={() => setPaymentModal({ id: '', outstanding: 0, show: false })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Record Payment</h3>
            <p className="text-sm text-surface-500 mb-4">Outstanding: <strong className="text-danger-600">{formatINR(paymentModal.outstanding)}</strong></p>

            <div className="space-y-4">
              <div>
                <label htmlFor="payment-utr" className="label">UTR Number</label>
                <input id="payment-utr" className="input" placeholder="Enter UTR number" value={form.utrNumber} onChange={e => setForm({...form, utrNumber: e.target.value})} />
              </div>
              <div>
                <label htmlFor="payment-amount" className="label">Amount (₹)</label>
                <input 
                  id="payment-amount" 
                  type="text" 
                  className="input font-mono" 
                  placeholder="Enter amount" 
                  value={form.amount ? form.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ''} 
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, '');
                    if ((val.match(/\./g) || []).length > 1) val = val.replace(/\.+$/, '');
                    if (!val) {
                      setForm({...form, amount: ''});
                    } else {
                      const parts = val.split('.');
                      parts[0] = parts[0] ? Number(parts[0]).toLocaleString('en-IN') : '0';
                      setForm({...form, amount: parts.join('.')});
                    }
                  }} 
                />
              </div>
              <div>
                <label htmlFor="payment-date" className="label">Payment Date</label>
                <input id="payment-date" type="date" className="input" value={form.paymentDate} onChange={e => setForm({...form, paymentDate: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setPaymentModal({ id: '', outstanding: 0, show: false })} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleRecordPayment} disabled={actionLoading} className="btn-primary flex-1">
                {actionLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
