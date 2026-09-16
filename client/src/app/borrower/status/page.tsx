'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '../../../hooks/useRedux';
import { logout } from '../../../store/authSlice';
import { loanAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, string> = {
  APPLIED: 'badge-applied',
  SANCTIONED: 'badge-sanctioned',
  REJECTED: 'badge-rejected',
  DISBURSED: 'badge-disbursed',
  CLOSED: 'badge-closed',
};

export default function BorrowerStatusPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'Borrower') { router.push('/'); return; }
    fetchApplications();
  }, [isAuthenticated, user, router]);

  const fetchApplications = async () => {
    try {
      const res = await loanAPI.getMyApplications();
      setApplications(res.data.data.applications);
    } catch { toast.error('Failed to load applications'); }
    finally { setLoading(false); }
  };

  const toggleDetails = async (app: any) => {
    if (expandedAppId === app._id) {
      setExpandedAppId(null);
      return;
    }
    setExpandedAppId(app._id);
    if (!payments[app._id]) {
      try {
        const res = await loanAPI.getPayments(app._id);
        setPayments(prev => ({ ...prev, [app._id]: res.data.data.payments }));
      } catch {
        toast.error('Failed to load payment history');
      }
    }
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const calculateDueDate = (date: string, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return formatDate(d.toISOString());
  };

  if (!isAuthenticated || user?.role !== 'Borrower') return null;

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-white/80 backdrop-blur-xl border-b border-surface-200 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
             </div>
             <span className="font-bold text-surface-900 text-xl tracking-tight">LoanGuard</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <button onClick={() => router.push('/borrower/apply')} className="text-sm font-medium text-surface-600 hover:text-primary-600 transition-colors hidden sm:block">
               + New Application
             </button>
             <div className="hidden sm:block h-6 w-px bg-surface-200" />
             <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                   <span className="text-sm font-semibold text-surface-900">{user?.name}</span>
                   <span className="text-xs text-surface-500">{user?.role}</span>
                </div>
                <div className="w-9 h-9 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm border border-primary-200">
                  {user?.name?.[0]}
                </div>
             </div>
             <button
                onClick={() => { dispatch(logout()); router.push('/login'); }}
                className="btn-ghost btn-sm text-surface-500 hover:text-danger-600 p-2 rounded-lg ml-1"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10 bg-white p-8 rounded-3xl border border-surface-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg className="w-32 h-32 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-surface-900 mb-2">My Applications</h1>
          <p className="text-surface-500 text-lg max-w-xl">Track the status of your loan applications, view payment schedules, and monitor your progress.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : applications.length === 0 ? (
          <div className="empty-state">
            <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-surface-700">No applications yet</h3>
            <p className="text-surface-500 text-sm mt-1">Start by creating your first loan application</p>
            <button onClick={() => router.push('/borrower/apply')} className="btn-primary mt-4">Apply Now</button>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div key={app._id} className={`card cursor-pointer transition-all ${expandedAppId === app._id ? 'ring-2 ring-primary-500' : 'hover:shadow-card-hover'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2" onClick={() => toggleDetails(app)}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${expandedAppId === app._id ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-600'}`}>
                      <span className="font-bold text-lg">₹</span>
                    </div>
                    <div>
                      <p className="font-semibold text-surface-900 text-lg">{formatINR(app.principal)}</p>
                      <p className="text-sm text-surface-500">Applied on {formatDate(app.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3">
                    <span className={STATUS_STYLES[app.status] || 'badge'}>{app.status}</span>
                    <button className="p-2 rounded-full hover:bg-surface-100 transition-colors">
                      <svg className={`w-5 h-5 text-surface-500 transform transition-transform ${expandedAppId === app._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Details Dropdown */}
                {expandedAppId === app._id && (
                  <div className="mt-4 pt-6 border-t border-surface-100 animate-fade-in cursor-default" onClick={e => e.stopPropagation()}>
                    
                    {/* Visual Status Stepper */}
                    <div className="mb-8 px-4">
                      <div className="flex items-center justify-between relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-surface-200 rounded-full z-0"></div>
                        
                        {(() => {
                          const steps = ['APPLIED', 'SANCTIONED', app.status === 'REJECTED' ? 'REJECTED' : 'DISBURSED', 'CLOSED'];
                          let currentIndex = steps.indexOf(app.status);
                          // If current status isn't in the list (e.g., intermediate states), fallback
                          if (currentIndex === -1) {
                            if (app.status === 'REJECTED') currentIndex = 2;
                            else currentIndex = 0;
                          }

                          return steps.map((step, index) => {
                            const isCompleted = index <= currentIndex;
                            const isCurrent = index === currentIndex;
                            const isRejected = step === 'REJECTED';
                            
                            let bgColor = 'bg-surface-200';
                            let textColor = 'text-surface-400';
                            let icon = '•';
                            
                            if (isCompleted) {
                              if (isRejected) {
                                bgColor = 'bg-danger-500 ring-4 ring-danger-50';
                                textColor = 'text-danger-600 font-bold';
                                icon = '✕';
                              } else {
                                bgColor = 'bg-primary-500 ring-4 ring-primary-50';
                                textColor = 'text-primary-700 font-bold';
                                icon = '✓';
                              }
                            }
                            if (isCurrent && !isRejected) {
                              bgColor = 'bg-primary-600 ring-4 ring-primary-100 animate-pulse';
                              icon = '○';
                            }
                            
                            return (
                              <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-all duration-500 ${bgColor}`}>
                                  {icon}
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider ${textColor}`}>{step}</span>
                              </div>
                            );
                          });
                        })()}
                        
                        {/* Fill bar overlay for completed steps */}
                        {(() => {
                          const steps = ['APPLIED', 'SANCTIONED', app.status === 'REJECTED' ? 'REJECTED' : 'DISBURSED', 'CLOSED'];
                          const currentIndex = Math.max(0, steps.indexOf(app.status));
                          const percentage = (currentIndex / (steps.length - 1)) * 100;
                          const color = app.status === 'REJECTED' ? 'bg-danger-500' : 'bg-primary-500';
                          return (
                            <div 
                              className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full z-0 transition-all duration-1000 ease-out ${color}`} 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Left: Summary */}
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Loan Details</h4>
                          <div className="space-y-2 text-sm font-mono text-surface-700">
                            <div className="flex justify-between"><span className="text-surface-500">Principal:</span><span className="font-medium">{formatINR(app.principal)}</span></div>
                            <div className="flex justify-between"><span className="text-surface-500">Interest:</span><span className="font-medium">{formatINR(app.interestAmount)}</span></div>
                            <div className="flex justify-between pt-2 border-t border-surface-100"><span className="text-surface-500">Total Repayment:</span><span className="font-semibold text-surface-900">{formatINR(app.totalRepayment)}</span></div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Current Status</h4>
                          <div className="space-y-2 text-sm font-mono text-surface-700">
                            <div className="flex justify-between"><span className="text-surface-500">Amount Paid:</span><span className="text-success-600 font-medium">{formatINR(app.totalPaid || 0)}</span></div>
                            <div className="flex justify-between"><span className="text-surface-500">Outstanding:</span><span className="text-danger-600 font-semibold">{formatINR(app.outstandingAmount)}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Schedule */}
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Schedule</h4>
                          <div className="space-y-2 text-sm font-mono text-surface-700">
                            <div className="flex justify-between"><span className="text-surface-500">Tenure:</span><span className="font-medium">{app.tenureDays} days</span></div>
                            {app.disbursedAt ? (
                              <>
                                <div className="flex justify-between"><span className="text-surface-500">Disbursed On:</span><span className="font-medium">{formatDate(app.disbursedAt)}</span></div>
                                <div className="flex justify-between"><span className="text-surface-500">Due Date:</span><span className="font-semibold text-warning-600">{calculateDueDate(app.disbursedAt, app.tenureDays)}</span></div>
                              </>
                            ) : (
                              <div className="flex justify-between"><span className="text-surface-500">Disbursement:</span><span className="text-surface-400 italic">Pending</span></div>
                            )}
                          </div>
                        </div>
                        
                        {app.rejectionReason && (
                          <div className="p-3 bg-danger-50 rounded-lg text-sm">
                            <h5 className="font-semibold text-danger-700 mb-1">Rejection Reason</h5>
                            <p className="text-danger-600">{app.rejectionReason}</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Payment History */}
                      <div>
                        <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Payment History</h4>
                        <div className="bg-surface-50 rounded-xl border border-surface-200 overflow-hidden">
                          {!payments[app._id] ? (
                            <div className="p-4 flex justify-center"><div className="w-5 h-5 rounded-full border-2 border-surface-300 border-t-primary-500 animate-spin"></div></div>
                          ) : payments[app._id].length === 0 ? (
                            <div className="p-6 text-center text-sm text-surface-500 italic">No payments recorded yet.</div>
                          ) : (
                            <div className="max-h-[220px] overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-surface-100 text-surface-500 sticky top-0">
                                  <tr>
                                    <th className="py-2 px-3 font-medium">Amount</th>
                                    <th className="py-2 px-3 font-medium">Date</th>
                                    <th className="py-2 px-3 font-medium">UTR</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100 font-mono text-[11px] text-surface-700">
                                  {payments[app._id].map(payment => (
                                    <tr key={payment._id} className="hover:bg-white transition-colors">
                                      <td className="py-2 px-3 font-semibold text-success-600">{formatINR(payment.amount)}</td>
                                      <td className="py-2 px-3">{formatDate(payment.paymentDate)}</td>
                                      <td className="py-2 px-3 text-surface-500">{payment.utrNumber}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
