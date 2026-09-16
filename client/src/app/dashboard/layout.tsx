'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { logout } from '../../store/authSlice';

const ROLE_MENUS: Record<string, { label: string; path: string; icon: string }[]> = {
  Admin: [
    { label: 'Overview', path: '/dashboard/admin', icon: '📊' },
    { label: 'Sales', path: '/dashboard/sales', icon: '📈' },
    { label: 'Sanction', path: '/dashboard/sanction', icon: '✅' },
    { label: 'Disbursement', path: '/dashboard/disbursement', icon: '💰' },
    { label: 'Collection', path: '/dashboard/collection', icon: '💳' },
    { label: 'Audit Logs', path: '/dashboard/audit', icon: '📋' },
  ],
  Sales: [{ label: 'Sales Dashboard', path: '/dashboard/sales', icon: '📈' }],
  Sanction: [{ label: 'Sanction Queue', path: '/dashboard/sanction', icon: '✅' }],
  Disbursement: [{ label: 'Disbursement Queue', path: '/dashboard/disbursement', icon: '💰' }],
  Collection: [{ label: 'Collection', path: '/dashboard/collection', icon: '💳' }],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
    if (user?.role === 'Borrower') router.push('/borrower/apply');
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role === 'Borrower') return null;

  const menu = ROLE_MENUS[user?.role || ''] || [];

  return (
    <div className="flex min-h-screen bg-surface-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        sidebar fixed lg:static inset-y-0 left-0 z-50
        transition-all duration-300 transform
        ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'}
      `}>
        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-surface-100 mb-2">
          <div className="w-10 h-10 bg-surface-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          {sidebarOpen && <span className="font-bold text-surface-900 text-lg tracking-tight">LoanGuard</span>}
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          {menu.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                router.push(item.path);
                // Auto-close on mobile after clicking a link
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`sidebar-item w-full ${pathname === item.path ? 'sidebar-item-active' : ''}`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-surface-100 bg-surface-50/50 m-3 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-surface-900 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
              {user?.name?.[0]}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-900 truncate">{user?.name}</p>
                <p className="text-xs font-medium text-surface-500">{user?.role}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={() => { dispatch(logout()); router.push('/login'); }}
              className="mt-3 w-full py-2 px-3 text-xs font-semibold text-surface-600 bg-white border border-surface-200 rounded-xl hover:bg-surface-100 hover:text-surface-900 transition-colors flex justify-center items-center gap-2 shadow-sm"
            >
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300">
        {/* Top Bar */}
        <header className="bg-white border-b border-surface-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-ghost btn-sm p-2 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="badge bg-primary-100 text-primary-600 hidden sm:inline-flex">{user?.role}</span>
            <button
              onClick={() => {
                dispatch(logout());
                router.push('/login');
              }}
              className="btn-ghost btn-sm text-surface-600 hover:text-danger-600 flex items-center gap-1.5 p-2 rounded-lg"
              title="Logout"
            >
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
