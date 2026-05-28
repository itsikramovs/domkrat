'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export type { ReviewSummary } from '@/lib/api/reviews-server';

export interface CreateReviewInput {
  rating: number;
  title?: string;
  comment?: string;
  pros?: string;
  cons?: string;
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, ...body }: CreateReviewInput & { productId: string }) =>
      apiFetch(`/products/${productId}/reviews`, { method: 'POST', body }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['reviews', vars.productId] });
    },
  });
}

export function useMyOrderItems(orderId: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['order-items', orderId, t],
    queryFn: () => apiFetch<{ items: { id: string; productId: string; quantity: number; productSnapshot: { sku: string; name: { ru: string; uz: string } } }[] }>(`/orders/${orderId}`),
    enabled: Boolean(t) && Boolean(orderId),
  });
}
