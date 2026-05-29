'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  useEffect(() => {
    if (hasHydrated && !accessToken) router.replace('/login');
  }, [hasHydrated, accessToken, router]);
  if (!hasHydrated || !accessToken) return null;
  return <>{children}</>;
}
