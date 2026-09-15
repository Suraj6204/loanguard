'use client';

import { useState, useEffect } from 'react';
import { operationsAPI, loanAPI } from '@/services/api';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, string> = {
  APPLIED: 'badge-applied', SANCTIONED: 'badge-sanctioned', REJECTED: 'badge-rejected',
  DISBURSED: 'badge-disbursed', CLOSED: 'badge-closed',
};

export default function SanctionPage() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ id: string; show: boolean }>({ id: '', show: false });
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [timelines, setTimelines] = useState<Record<string, any[]>>({});

  useEffect(() => { fetchLoans(); }, []);

  const fetchLoans = async () => {
    try {
      const res = await operationsAPI.getSanctionQueue();
      setLoans(res.data.data || []);
    } catch { toast.error('Failed to load loans'); }
    finally { setLoading(false); }
  };

  const handleSanction = async (id: string) => {
    setActionLoading(id);
    try {
      await loanAPI.sanction(id);
      toast.success('Loan sanctioned!');
      fetchLoans();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(''); }
  };

  const handleReject = async () => {
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    setActionLoading(rejectModal.id);
    try {
      await loanAPI.reject(rejectModal.id, reason);
      toast.success('Loan rejected');
      setRejectModal({ id: '', show: false });
      setReason('');
      fetchLoans();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActionLoading(''); }
  };

  const toggleDetails = async (loanId: string) => {
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
      return;
    }
    setExpandedLoan(loanId);
    if (!timelines[loanId]) {
      try {
        const res = await loanAPI.getTimeline(loanId);
        setTimelines(prev => ({ ...prev, [loanId]: res.data.data.timeline }));
      } catch {
        toast.error('Failed to load timeline');
      }
    }
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Sanction Queue</h1>
          <p className="page-subtitle">Review and approve/reject pending loan applications</p>
        </div>
        <span className="badge bg-warning-100 text-warning-600">{loans.length} Pending</span>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
      ) : loans.length === 0 ? (
        <div className="empty-state">
          <div className="w-20 h-20 bg-accent-100 rounded-full flex items-center justify-center mb-4 text-3xl">✅</div>
          <h3 className="text-lg font-semibold text-surface-700">All caught up!</h3>
          <p className="text-surface-500 text-sm">No pending applications to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan: any) => (
            <div key={loan._id} className="card">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-surface-900">{loan.borrowerId?.name || 'Unknown'}</h3>
                    <span className={STATUS_STYLES[loan.status]}>{loan.status}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                    <div><span className="text-surface-500">Amount: </span><span className="font-medium">{formatINR(loan.principal)}</span></div>
                    <div><span className="text-surface-500">Tenure: </span><span className="font-medium">{loan.tenureDays} days</span></div>
                    <div><span className="text-surface-500">Interest: </span><span className="font-medium">{formatINR(loan.interestAmount)}</span></div>
                    <div><span className="text-surface-500">Repay: </span><span className="font-medium">{formatINR(loan.totalRepayment)}</span></div>
                  </div>
                  <div className="text-xs text-surface-400">
                    PAN: {loan.borrowerId?.pan || 'N/A'} • Salary: {formatINR(loan.borrowerId?.monthlySalary || 0)}/mo • Applied: {formatDate(loan.createdAt)}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 min-w-[120px]">
                  <button
                    onClick={() => handleSanction(loan._id)}
                    disabled={actionLoading === loan._id}
                    className="btn-success btn-sm w-full"
                  >
                    {actionLoading === loan._id ? '...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => setRejectModal({ id: loan._id, show: true })}
                    disabled={actionLoading === loan._id}
                    className="btn-danger btn-sm w-full"
                  >
                    ✗ Reject
                  </button>
                  <button 
                    onClick={() => toggleDetails(loan._id)} 
                    className="btn-secondary btn-sm w-full mt-1"
                  >
                    {expandedLoan === loan._id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>
              </div>

              {/* Expanded Details Section */}
              {expandedLoan === loan._id && (
                <div className="mt-6 pt-6 border-t border-surface-100 animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column: BRE & Document */}
                  <div>
                    <h4 className="text-sm font-semibold text-surface-900 mb-3 uppercase tracking-wider">Document & Eligibility</h4>
                    
                    <div className="bg-surface-50 rounded-xl p-4 mb-4 border border-surface-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">📄</span>
                        <span className="font-medium text-surface-700 text-sm">Document Status</span>
                      </div>
                      <div className="text-sm flex justify-between items-center bg-white p-2 rounded-lg border border-surface-100 shadow-sm">
                        <span className="text-surface-500 truncate mr-2" title={loan.documentId?.originalName}>
                          {loan.documentId?.originalName || 'Unknown file'}
                        </span>
                        {loan.documentId?.validationStatus === 'VALID' ? (
                          <span className="badge bg-accent-100 text-accent-600 shrink-0">✓ VALID</span>
                        ) : (
                          <span className="badge bg-warning-100 text-warning-600 shrink-0">{loan.documentId?.validationStatus}</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface-50 rounded-xl p-4 border border-surface-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🤖</span>
                        <span className="font-medium text-surface-700 text-sm">BRE Result</span>
                      </div>
                      {/* Extract BRE Result from timeline if available */}
                      {(() => {
                        const breLog = timelines[loan._id]?.find(l => l.action === 'BRE_PASSED');
                        if (breLog && breLog.metadata?.breResult) {
                          return (
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-1 text-accent-600 font-semibold mb-2">
                                ✓ Eligibility Rules Passed
                              </div>
                              {breLog.metadata.breResult.reasons?.map((r: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-surface-100">
                                  <span className="text-accent-500 mt-0.5">✓</span>
                                  <span className="text-surface-600">{r.message}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return <div className="text-xs text-surface-500 italic">BRE data loading or unavailable...</div>;
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Timeline */}
                  <div>
                    <h4 className="text-sm font-semibold text-surface-900 mb-3 uppercase tracking-wider">Application Timeline</h4>
                    <div className="bg-surface-50 rounded-xl p-5 border border-surface-200 max-h-[300px] overflow-y-auto">
                      {!timelines[loan._id] ? (
                        <div className="skeleton h-20 rounded-lg"></div>
                      ) : timelines[loan._id].length === 0 ? (
                        <p className="text-sm text-surface-500">No timeline events found</p>
                      ) : (
                        <div className="space-y-4">
                          {timelines[loan._id].map((event, index) => (
                            <div key={index} className="timeline-item pb-4 last:pb-0 relative">
                              <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-primary-500 ring-4 ring-primary-100 z-10"></div>
                              <div className="pl-6">
                                <p className="text-sm font-medium text-surface-900">{event.action.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-surface-500 mt-0.5">
                                  {formatDate(event.createdAt)} at {formatTime(event.createdAt)}
                                </p>
                                {event.actorRole && (
                                  <p className="text-[10px] text-surface-400 mt-1 uppercase">By {event.actorRole}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.show && (
        <div className="modal-overlay" onClick={() => setRejectModal({ id: '', show: false })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Reject Application</h3>
            <p className="text-sm text-surface-600 mb-4">Please provide a reason for rejection. This will be shown to the borrower.</p>
            <textarea
              className="input min-h-[100px]"
              placeholder="Enter rejection reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal({ id: '', show: false })} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleReject} disabled={!!actionLoading} className="btn-danger flex-1">
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
