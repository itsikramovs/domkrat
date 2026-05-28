'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  useEffect(() => {
    if (accessToken === null) router.replace('/login');
  }, [accessToken, router]);
  if (!accessToken) return null;
  return <>{children}</>;
}
