'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { UserAddress } from '@/lib/types';

export function useAddresses() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<UserAddress[]>({
    queryKey: ['addresses', accessToken],
    queryFn: () => apiFetch<UserAddress[]>('/me/addresses'),
    enabled: Boolean(accessToken),
  });
}

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<{
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    roles: string[];
  }>({
    queryKey: ['me', accessToken],
    queryFn: () => apiFetch('/me'),
    enabled: Boolean(accessToken),
  });
}
