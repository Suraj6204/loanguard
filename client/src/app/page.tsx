'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '../hooks/useRedux';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Route based on role
    switch (user?.role) {
      case 'Borrower':
        router.push('/borrower/apply');
        break;
      case 'Admin':
        router.push('/dashboard/admin');
        break;
      case 'Sales':
        router.push('/dashboard/sales');
        break;
      case 'Sanction':
        router.push('/dashboard/sanction');
        break;
      case 'Disbursement':
        router.push('/dashboard/disbursement');
        break;
      case 'Collection':
        router.push('/dashboard/collection');
        break;
      default:
        router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-surface-500 text-sm">Redirecting...</p>
      </div>
    </div>
  );
}
