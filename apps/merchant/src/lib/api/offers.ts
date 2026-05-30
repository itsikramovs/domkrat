'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { MultiLangText } from '@/lib/types';

export type OfferStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';

export interface MyOffer {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  price: string;
  compareAtPrice: string | null;
  vatRate: string;
  status: OfferStatus;
  stock: number;
  reserved: number;
  product: {
    id: string;
    name: MultiLangText;
    slug: string;
    status: string;
    images: Array<{ url: string; thumbnailUrl: string | null }>;
  };
  variant: { id: string; name: MultiLangText | null; isDefault: boolean };
}

export function useMyOffers() {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['merchant-offers', t],
    queryFn: () => apiFetch<MyOffer[]>('/merchant/offers'),
    enabled: Boolean(t),
  });
}

export function useUpdateMyOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { price?: number; compareAtPrice?: number | null; vatRate?: number };
    }) => apiFetch<MyOffer>(`/merchant/offers/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-offers'] }),
  });
}

export function useSetMyOfferStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OfferStatus }) =>
      apiFetch<MyOffer>(`/merchant/offers/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-offers'] }),
  });
}

export function useReceiveMyOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { warehouseId: string; cellId: string; quantity: number; unitCost?: number };
    }) => apiFetch(`/merchant/offers/${id}/receive`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-offers'] }),
  });
}
