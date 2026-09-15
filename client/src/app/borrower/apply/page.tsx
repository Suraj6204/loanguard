'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { setUser, logout } from '@/store/authSlice';
import { borrowerAPI, documentAPI, loanAPI } from '@/services/api';
import toast from 'react-hot-toast';

// ============================================================
// STEP COMPONENTS
// ============================================================

function ProfileStep({ onComplete, user }: { onComplete: () => void; user: any }) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({
    name: user?.name || '',
    pan: user?.pan || '',
    dateOfBirth: user?.dateOfBirth?.split('T')[0] || '',
    monthlySalary: user?.monthlySalary || '',
    employmentMode: user?.employmentMode || '',
  });
  const [breResult, setBreResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const res = await borrowerAPI.updateProfile({
        ...form,
        monthlySalary: Number(form.monthlySalary),
      });
      const data = res.data.data;
      setBreResult(data.breResult);
      dispatch(setUser(data.user));
      if (data.breResult.eligible) {
        toast.success('Profile saved & BRE passed!');
        onComplete();
      } else {
        toast.error('You are not eligible. Check the reasons below.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update profile';
      toast.error(msg);
      if (err.response?.data?.details?.errors) {
        const fieldErrors: Record<string, string> = {};
        err.response.data.details.errors.forEach((e: any) => {
          fieldErrors[e.field] = e.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold mb-1">Personal Details</h2>
      <p className="text-surface-500 text-sm mb-6">Fill in your details for eligibility check</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-name" className="label">Full Name</label>
            <input id="profile-name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            {errors.name && <p className="text-danger-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="profile-pan" className="label">PAN Number</label>
            <input id="profile-pan" className={`input ${errors.pan ? 'input-error' : ''}`} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10} required />
            {errors.pan && <p className="text-danger-500 text-xs mt-1">{errors.pan}</p>}
          </div>
          <div>
            <label htmlFor="profile-dob" className="label">Date of Birth</label>
            <input id="profile-dob" type="date" className={`input ${errors.dateOfBirth ? 'input-error' : ''}`} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required />
            {errors.dateOfBirth && <p className="text-danger-500 text-xs mt-1">{errors.dateOfBirth}</p>}
          </div>
          <div>
            <label htmlFor="profile-salary" className="label">Monthly Salary (₹)</label>
            <input id="profile-salary" type="number" className={`input ${errors.monthlySalary ? 'input-error' : ''}`} value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} min={0} required />
            {errors.monthlySalary && <p className="text-danger-500 text-xs mt-1">{errors.monthlySalary}</p>}
          </div>
        </div>
        <div>
          <label htmlFor="profile-employment" className="label">Employment Mode</label>
          <select id="profile-employment" className={`input ${errors.employmentMode ? 'input-error' : ''}`} value={form.employmentMode} onChange={(e) => setForm({ ...form, employmentMode: e.target.value })} required>
            <option value="">Select employment type</option>
            <option value="Salaried">Salaried</option>
            <option value="SelfEmployed">Self Employed</option>
            <option value="Unemployed">Unemployed</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
          {loading ? 'Validating...' : 'Save & Check Eligibility'}
        </button>
      </form>

      {breResult && (
        <div className={`mt-6 p-4 rounded-xl border ${breResult.eligible ? 'bg-accent-50 border-accent-200' : 'bg-danger-50 border-danger-200'} animate-fade-in`}>
          <h3 className={`font-semibold text-sm ${breResult.eligible ? 'text-accent-700' : 'text-danger-700'}`}>
            {breResult.eligible ? '✅ Eligible for Loan' : '❌ Not Eligible'}
          </h3>
          <ul className="mt-2 space-y-1">
            {breResult.reasons.map((r: any, i: number) => (
              <li key={i} className={`text-sm flex items-center gap-2 ${r.passed ? 'text-accent-600' : 'text-danger-600'}`}>
                <span>{r.passed ? '✓' : '✗'}</span>
                <span>{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DocumentStep({ onComplete, onDocumentId }: { onComplete: () => void; onDocumentId: (id: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [document, setDocument] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const res = await documentAPI.upload(file);
      setDocument(res.data.data.document);
      onDocumentId(res.data.data.document._id);
      toast.success('Document uploaded & validated!');
      onComplete();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Upload failed';
      setUploadError(msg);
      toast.error(msg);
      // Show validation details if available
      if (err.response?.data?.details?.validationResults) {
        setDocument({ validationResults: err.response.data.details.validationResults, failed: true });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold mb-1">Upload Salary Slip</h2>
      <p className="text-surface-500 text-sm mb-6">Upload your latest salary slip for verification</p>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
          ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-surface-300 hover:border-primary-400 hover:bg-surface-50'}
          ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input type="file" id="doc-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileInput} />
        <label htmlFor="doc-upload" className="cursor-pointer">
          <div className="w-16 h-16 mx-auto bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-medium text-surface-700">
            {uploading ? 'Uploading & validating...' : 'Drop your file here or click to browse'}
          </p>
          <p className="text-xs text-surface-400 mt-1">PDF, JPG, JPEG, PNG • Max 5 MB</p>
        </label>
      </div>

      {uploadError && (
        <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-xl text-danger-600 text-sm">
          {uploadError}
        </div>
      )}

      {/* Validation Results */}
      {document?.validationResults && (
        <div className="mt-6 card">
          <h3 className="font-semibold text-sm mb-3">
            {document.failed ? '❌ Validation Failed' : '✅ Validation Passed'}
          </h3>
          <div className="space-y-2">
            {document.validationResults.steps.map((step: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step.passed ? 'bg-accent-100 text-accent-600' : 'bg-danger-100 text-danger-600'}`}>
                  {step.passed ? '✓' : '✗'}
                </span>
                <div>
                  <span className="font-medium text-surface-700">{step.step.replace(/_/g, ' ')}</span>
                  <p className="text-xs text-surface-500">{step.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {document && !document.failed && (
        <div className="mt-4 p-4 bg-accent-50 border border-accent-200 rounded-xl animate-fade-in">
          <p className="text-sm text-accent-700 font-medium">✅ {document.originalName} uploaded successfully</p>
          <p className="text-xs text-accent-600 mt-1">SHA-256: {document.sha256?.substring(0, 16)}...</p>
        </div>
      )}
    </div>
  );
}

function LoanConfigStep({ onComplete, onLoanConfig }: { onComplete: () => void; onLoanConfig: (config: any) => void }) {
  const [principal, setPrincipal] = useState(200000);
  const [tenureDays, setTenureDays] = useState(180);
  const [calculation, setCalculation] = useState<any>(null);

  useEffect(() => {
    const interest = (principal * 12 * tenureDays) / (365 * 100);
    const total = principal + interest;
    setCalculation({
      principal,
      tenureDays,
      annualInterestRate: 12,
      interestAmount: parseFloat(interest.toFixed(2)),
      totalRepayment: parseFloat(total.toFixed(2)),
    });
  }, [principal, tenureDays]);

  const handleConfirm = () => {
    onLoanConfig({ principal, tenureDays });
    onComplete();
  };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold mb-1">Loan Configuration</h2>
      <p className="text-surface-500 text-sm mb-6">Select your loan amount and tenure</p>

      <div className="space-y-8">
        {/* Amount Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="label mb-0">Loan Amount</label>
            <span className="text-2xl font-bold text-primary-600">{formatINR(principal)}</span>
          </div>
          <input
            type="range"
            min={50000} max={500000} step={10000}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="range-slider"
          />
          <div className="flex justify-between text-xs text-surface-400 mt-1">
            <span>₹50,000</span>
            <span>₹5,00,000</span>
          </div>
        </div>

        {/* Tenure Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="label mb-0">Tenure</label>
            <span className="text-2xl font-bold text-primary-600">{tenureDays} days</span>
          </div>
          <input
            type="range"
            min={30} max={365} step={1}
            value={tenureDays}
            onChange={(e) => setTenureDays(Number(e.target.value))}
            className="range-slider"
          />
          <div className="flex justify-between text-xs text-surface-400 mt-1">
            <span>30 days</span>
            <span>365 days</span>
          </div>
        </div>

        {/* Live Calculation Panel */}
        {calculation && (
          <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl p-6 border border-primary-100">
            <h3 className="font-semibold text-surface-800 mb-4">Repayment Breakdown</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-surface-500 uppercase tracking-wider">Principal</p>
                <p className="text-lg font-bold text-surface-800">{formatINR(calculation.principal)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 uppercase tracking-wider">Interest Rate</p>
                <p className="text-lg font-bold text-surface-800">{calculation.annualInterestRate}% p.a.</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 uppercase tracking-wider">Interest Amount</p>
                <p className="text-lg font-bold text-warning-600">{formatINR(calculation.interestAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500 uppercase tracking-wider">Total Repayment</p>
                <p className="text-lg font-bold text-primary-600">{formatINR(calculation.totalRepayment)}</p>
              </div>
            </div>
            <p className="text-xs text-surface-400 mt-4 italic">* This is a preview. Final values are calculated by the server.</p>
          </div>
        )}

        <button onClick={handleConfirm} className="btn-primary btn-lg w-full">
          Confirm Loan Configuration
        </button>
      </div>
    </div>
  );
}

function ReviewStep({ documentId, loanConfig, user }: { documentId: string; loanConfig: any; user: any }) {
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const handleApply = async () => {
    setSubmitting(true);
    try {
      await loanAPI.create({
        principal: loanConfig.principal,
        tenureDays: loanConfig.tenureDays,
        documentId,
      });
      toast.success('🎉 Loan application submitted successfully!');
      router.push('/borrower/status');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Application failed');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold mb-1">Review & Apply</h2>
      <p className="text-surface-500 text-sm mb-6">Review your application before submitting</p>

      <div className="space-y-4">
        {/* Personal Info */}
        <div className="card">
          <h3 className="font-semibold text-sm text-surface-600 uppercase tracking-wider mb-3">Personal Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-surface-500">Name:</span> <span className="font-medium">{user?.name}</span></div>
            <div><span className="text-surface-500">PAN:</span> <span className="font-medium font-mono">{user?.pan}</span></div>
            <div><span className="text-surface-500">Salary:</span> <span className="font-medium">{formatINR(user?.monthlySalary || 0)}/mo</span></div>
            <div><span className="text-surface-500">Employment:</span> <span className="font-medium">{user?.employmentMode}</span></div>
          </div>
        </div>

        {/* Loan Config */}
        <div className="card">
          <h3 className="font-semibold text-sm text-surface-600 uppercase tracking-wider mb-3">Loan Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-surface-500">Amount:</span> <span className="font-medium">{formatINR(loanConfig?.principal || 0)}</span></div>
            <div><span className="text-surface-500">Tenure:</span> <span className="font-medium">{loanConfig?.tenureDays} days</span></div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-warning-50 border border-warning-100 rounded-xl">
          <svg className="w-5 h-5 text-warning-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-warning-700">Once submitted, your application cannot be modified. It will go through the sanction process.</p>
        </div>

        <button onClick={() => setShowConfirm(true)} disabled={submitting} className="btn-primary btn-lg w-full">
          Submit Application
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Confirm Application</h3>
            <p className="text-sm text-surface-600 mb-6">Are you sure you want to submit this loan application? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleApply} disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

const STEPS = ['Profile & BRE', 'Upload Document', 'Loan Config', 'Review & Apply'];

export default function BorrowerApplyPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const [currentStep, setCurrentStep] = useState(0);
  const [documentId, setDocumentId] = useState('');
  const [loanConfig, setLoanConfig] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'Borrower') {
      router.push(`/dashboard/${user?.role?.toLowerCase()}`);
      return;
    }
    // If profile already completed, skip to step 1
    if (user?.profileCompleted) {
      setCurrentStep(1);
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role !== 'Borrower') return null;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Top Bar */}
      <header className="bg-surface-900 border-b border-surface-800 px-6 py-4 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -left-20 w-48 h-48 bg-primary-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-accent-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <div className="max-w-4xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary-600/30">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg tracking-wide">LoanGuard</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/borrower/status')} className="text-surface-300 hover:text-white text-sm font-medium transition-colors">
              My Applications
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Stepper */}
        <div className="flex items-center mb-10">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`stepper-dot ${
                  i < currentStep ? 'stepper-dot-completed' :
                  i === currentStep ? 'stepper-dot-active' : 'stepper-dot-pending'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-2 text-center whitespace-nowrap ${
                  i <= currentStep ? 'text-primary-600 font-medium' : 'text-surface-400'
                }`}>{step}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`stepper-line ${i < currentStep ? 'stepper-line-active' : 'stepper-line-pending'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="card max-w-2xl mx-auto">
          {currentStep === 0 && <ProfileStep user={user} onComplete={() => setCurrentStep(1)} />}
          {currentStep === 1 && <DocumentStep onComplete={() => setCurrentStep(2)} onDocumentId={setDocumentId} />}
          {currentStep === 2 && <LoanConfigStep onComplete={() => setCurrentStep(3)} onLoanConfig={setLoanConfig} />}
          {currentStep === 3 && <ReviewStep documentId={documentId} loanConfig={loanConfig} user={user} />}
        </div>

        {/* Back Button */}
        {currentStep > 0 && (
          <div className="max-w-2xl mx-auto mt-4">
            <button onClick={() => setCurrentStep(currentStep - 1)} className="btn-ghost text-sm">
              ← Back to {STEPS[currentStep - 1]}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
