'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface ReturnItem {
  id: string;
  orderItemId: string;
  quantity: number;
}

export interface ReturnSummary {
  id: string;
  returnNumber: string;
  orderId: string;
  status: string;
  reason: string;
  refundAmount: string;
  requestedAt: string;
  refundedAt: string | null;
  items: ReturnItem[];
  order: { orderNumber: string };
}

export interface CreateReturnInput {
  reason: 'DEFECTIVE' | 'WRONG_ITEM' | 'NOT_FITTING' | 'CHANGED_MIND' | 'LATE_DELIVERY' | 'DAMAGED_IN_TRANSIT' | 'OTHER';
  reasonDescription?: string;
  pickupMethod: 'CUSTOMER_BRING' | 'COURIER_PICKUP';
  items: { orderItemId: string; quantity: number }[];
}

export function useMyReturns() {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery<ReturnSummary[]>({
    queryKey: ['my-returns', t],
    queryFn: () => apiFetch('/returns'),
    enabled: Boolean(t),
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...input }: CreateReturnInput & { orderId: string }) =>
      apiFetch(`/orders/${orderId}/return-request`, { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-returns'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
    },
  });
}
