'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { Paginated } from '@/lib/types';

export type SubOrderStatus =
  | 'CREATED'
  | 'PAID'
  | 'PROCESSING'
  | 'ASSEMBLED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'RETURNED';

export interface SubOrder {
  id: string;
  orderId: string;
  subOrderNumber: string;
  status: SubOrderStatus;
  subtotal: string;
  commissionAmount: string;
  merchantPayout: string;
  fulfillmentType: 'FBO' | 'FBS';
  confirmedAt: string | null;
  assembledAt: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    customerName: string;
    customerPhone: string | null;
    customerEmail: string | null;
    deliveryMethod: string;
    deliveryAddressSnapshot: {
      city: string;
      addressLine: string;
      recipientName: string;
      recipientPhone: string;
    } | null;
    placedAt: string;
    paidAt: string | null;
    paymentMethod: string;
  };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    status: string;
    productSnapshot: {
      sku: string;
      name: { ru: string; uz: string };
      slug: string;
      oemNumber: string | null;
    };
  }>;
}

export function useMerchantOrders(status?: SubOrderStatus) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<Paginated<SubOrder>>({
    queryKey: ['merchant-orders', status, accessToken],
    queryFn: () =>
      apiFetch<Paginated<SubOrder>>(`/merchant/orders${status ? `?status=${status}` : ''}`),
    enabled: Boolean(accessToken),
  });
}

export function useMerchantOrder(id: string | null) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<SubOrder>({
    queryKey: ['merchant-order', id, accessToken],
    queryFn: () => apiFetch<SubOrder>(`/merchant/orders/${id}`),
    enabled: Boolean(accessToken) && Boolean(id),
  });
}

export function useTransitionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'confirm' | 'ready' | 'ship' }) =>
      apiFetch<SubOrder>(`/merchant/orders/${input.id}/${input.action}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-orders'] });
      void qc.invalidateQueries({ queryKey: ['merchant-order'] });
      void qc.invalidateQueries({ queryKey: ['pick-list'] });
    },
  });
}

// --- WMS-сборка из ячеек ---
export interface PickListCell {
  cellId: string | null;
  code: string | null;
  available: number;
}
export interface PickListItem {
  orderItemId: string;
  name: { ru?: string; uz?: string } | null;
  sku: string | null;
  quantity: number;
  status: string;
  cells: PickListCell[];
  suggested: Array<{ cellId: string; qty: number }>;
  shortfall: number;
}
export interface PickList {
  subOrderId: string;
  status: SubOrderStatus;
  fulfillmentType: 'FBO' | 'FBS';
  items: PickListItem[];
}
export interface PickInput {
  id: string;
  items: Array<{ orderItemId: string; picks: Array<{ cellId: string | null; qty: number }> }>;
}

export function usePickList(id: string | null, enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<PickList>({
    queryKey: ['pick-list', id, accessToken],
    queryFn: () => apiFetch<PickList>(`/merchant/orders/${id}/pick-list`),
    enabled: Boolean(accessToken) && Boolean(id) && enabled,
  });
}

export function usePickSubOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PickInput) =>
      apiFetch(`/merchant/orders/${input.id}/pick`, {
        method: 'POST',
        body: { items: input.items },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-order'] });
      void qc.invalidateQueries({ queryKey: ['merchant-orders'] });
      void qc.invalidateQueries({ queryKey: ['pick-list'] });
    },
  });
}
