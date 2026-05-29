'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  useEffect(() => {
    // редиректим только ПОСЛЕ регидрации persist — иначе F5 выбрасывает на /login
    if (hasHydrated && !accessToken) router.replace('/login');
  }, [hasHydrated, accessToken, router]);
  if (!hasHydrated || !accessToken) return null;
  return <>{children}</>;
}
