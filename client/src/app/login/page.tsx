'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { loginUser, clearError } from '../../store/authSlice';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isLoading, error, isAuthenticated, user } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      toast.success(`Welcome back, ${user.name}!`);
      if (user.role === 'Borrower') router.push('/borrower/apply');
      else router.push(`/dashboard/${user.role.toLowerCase()}`);
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(loginUser({ email, password }));
  };

  return (
    <div className="min-h-screen flex bg-surface-50">
      {/* Left side - Branding & Visuals (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-900 via-surface-900 to-surface-950 opacity-90" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/30 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="relative z-10 p-12 text-center max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl mb-8 shadow-2xl border border-white/20">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4">LoanGuard</h1>
          <p className="text-lg text-surface-300 font-light leading-relaxed">
            The next-generation secure lending platform. Manage applications, sanction loans, and track disbursements with unparalleled ease.
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
             <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
               <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
               </svg>
             </div>
             <h1 className="text-3xl font-bold text-surface-900">LoanGuard</h1>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-surface-900 tracking-tight mb-2">Welcome back</h2>
            <p className="text-surface-500">Please enter your details to sign in.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-100 rounded-xl flex items-start gap-3 animate-fade-in">
              <svg className="w-5 h-5 text-danger-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-danger-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-surface-700 mb-2">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all duration-200"
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-surface-700 mb-2">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all duration-200 pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943-9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 transition-colors" />
                <span className="text-sm text-surface-600 group-hover:text-surface-900 transition-colors">Remember me</span>
              </label>
              <Link href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/25 focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in...
                </>
              ) : (
                'Sign in to account'
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-surface-100 text-center">
            <p className="text-sm text-surface-500">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                Apply for a loan now
              </Link>
            </p>
          </div>
          
          {/* Demo credentials hint */}
          <div className="mt-10 p-5 bg-surface-50 rounded-2xl border border-surface-200">
            <div className="flex items-center gap-2 mb-4 justify-center">
              <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-surface-600 font-bold uppercase tracking-wider">Demo Credentials (Click to Fill)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-surface-600 font-medium">
              {[
                { role: 'Admin', email: 'admin@loanguard.com', pass: 'Admin@123' },
                { role: 'Borrower', email: 'borrower@loanguard.com', pass: 'Borrower@123' },
                { role: 'Sales', email: 'sales@loanguard.com', pass: 'Sales@123' },
                { role: 'Sanction', email: 'sanction@loanguard.com', pass: 'Sanction@123' },
                { role: 'Disbursement', email: 'disbursement@loanguard.com', pass: 'Disbursement@123' },
                { role: 'Collection', email: 'collection@loanguard.com', pass: 'Collection@123' },
              ].map(cred => (
                <div key={cred.role} className="flex flex-col bg-white p-3 rounded-lg border border-surface-200 shadow-sm cursor-pointer hover:bg-primary-50 transition-colors" onClick={() => { setEmail(cred.email); setPassword(cred.pass); }}>
                  <span className="text-primary-600 text-[10px] font-bold uppercase mb-1">{cred.role}</span>
                  <span className="font-mono text-[13px]">{cred.email}</span>
                  <span className="font-mono text-surface-500 mt-1">{cred.pass}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
