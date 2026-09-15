'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { logout } from '@/store/authSlice';
import { loanAPI } from '@/services/api';
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
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);

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

  const viewTimeline = async (app: any) => {
    setSelectedApp(app);
    try {
      const res = await loanAPI.getTimeline(app._id);
      setTimeline(res.data.data.timeline);
    } catch { toast.error('Failed to load timeline'); }
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const TIMELINE_ICONS: Record<string, { bg: string; icon: string }> = {
    APPLICATION_CREATED: { bg: 'bg-primary-500', icon: '📋' },
    BRE_PASSED: { bg: 'bg-accent-500', icon: '✅' },
    BRE_FAILED: { bg: 'bg-danger-500', icon: '❌' },
    DOCUMENT_VALIDATED: { bg: 'bg-primary-400', icon: '📄' },
    DOCUMENT_UPLOADED: { bg: 'bg-primary-400', icon: '📤' },
    LOAN_APPROVED: { bg: 'bg-accent-500', icon: '✅' },
    LOAN_REJECTED: { bg: 'bg-danger-500', icon: '🚫' },
    LOAN_DISBURSED: { bg: 'bg-accent-600', icon: '💰' },
    PAYMENT_RECORDED: { bg: 'bg-primary-500', icon: '💳' },
    LOAN_CLOSED: { bg: 'bg-surface-600', icon: '🔒' },
  };

  if (!isAuthenticated || user?.role !== 'Borrower') return null;

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-surface-900 border-b border-surface-800 px-6 py-4 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -left-20 w-48 h-48 bg-primary-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-accent-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <div className="max-w-5xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-600/30">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg tracking-wide">LoanGuard</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/borrower/apply')} className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg shadow-lg shadow-primary-600/30 hover:bg-primary-500 transition-colors">
              + New Application
            </button>
            <div className="flex items-center gap-2 border-l border-surface-700 pl-4">
              <div className="w-8 h-8 bg-surface-800 border border-surface-700 rounded-full flex items-center justify-center text-primary-400 font-semibold text-sm">
                {user?.name?.[0]}
              </div>
            </div>
            <button
              onClick={() => {
                dispatch(logout());
                router.push('/login');
              }}
              className="text-surface-400 hover:text-danger-400 flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-800 transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
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
              <div key={app._id} className="card hover:shadow-card-hover cursor-pointer" onClick={() => viewTimeline(app)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <span className="text-primary-600 font-bold text-sm">₹</span>
                    </div>
                    <div>
                      <p className="font-semibold text-surface-900">{formatINR(app.principal)}</p>
                      <p className="text-xs text-surface-500">{app.tenureDays} days • {formatDate(app.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={STATUS_STYLES[app.status] || 'badge'}>{app.status}</span>
                    {app.status === 'DISBURSED' && (
                      <p className="text-xs text-surface-500 mt-1">
                        Outstanding: {formatINR(app.outstandingAmount)}
                      </p>
                    )}
                  </div>
                </div>
                {app.rejectionReason && (
                  <div className="mt-3 p-3 bg-danger-50 rounded-lg text-sm text-danger-600">
                    Reason: {app.rejectionReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timeline Modal */}
        {selectedApp && (
          <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
            <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Loan Timeline</h3>
                  <p className="text-sm text-surface-500">{formatINR(selectedApp.principal)} • {selectedApp.status}</p>
                </div>
                <button onClick={() => setSelectedApp(null)} className="btn-ghost btn-sm">✕</button>
              </div>

              {timeline.length === 0 ? (
                <p className="text-center text-surface-500 py-8">No timeline events yet</p>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event: any, i: number) => {
                    const style = TIMELINE_ICONS[event.action] || { bg: 'bg-surface-400', icon: '📝' };
                    return (
                      <div key={i} className="timeline-item">
                        <div className={`timeline-dot ${style.bg}`}>
                          <span className="text-xs">{style.icon}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-surface-800">
                            {event.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-surface-500 mt-0.5">
                            {formatDate(event.createdAt)}
                            {event.actorId?.name && ` • by ${event.actorId.name}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
