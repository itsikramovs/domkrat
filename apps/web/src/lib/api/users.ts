'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export interface CreateAddressInput {
  title?: string;
  recipientName: string;
  recipientPhone: string;
  region: string;
  city: string;
  district?: string;
  addressLine: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  isLegalEntity?: boolean;
  companyName?: string;
  taxId?: string;
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAddressInput) =>
      apiFetch<UserAddress>('/me/addresses', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
}

export function useUpdateAddress(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateAddressInput>) =>
      apiFetch<UserAddress>(`/me/addresses/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/me/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/addresses/${id}/set-default`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['addresses'] });
    },
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
