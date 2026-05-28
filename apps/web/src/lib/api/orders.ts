'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { Order, Paginated } from '@/lib/types';

export interface CreateOrderInput {
  deliveryAddressId?: string;
  deliveryMethod: 'SELF_PICKUP' | 'PLATFORM_COURIER' | 'EXTERNAL_DELIVERY' | 'MERCHANT_DELIVERY';
  pickupPointId?: string;
  paymentMethod: 'CLICK' | 'PAYME' | 'UZUM' | 'COD' | 'MOCK';
  promoCode?: string;
  customerNotes?: string;
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: CreateOrderInput) =>
      apiFetch<Order>('/orders', { method: 'POST', body: input }),
  });
}

export function usePayOrder() {
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<{
        paymentId: string;
        status: string;
        paymentUrl?: string;
        orderStatus: string;
        paymentStatus: string;
      }>(`/orders/${orderId}/payment`, { method: 'POST' }),
  });
}

export function useMyOrders(page = 1, perPage = 20) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<Paginated<Order>>({
    queryKey: ['orders', page, perPage, accessToken],
    queryFn: () => apiFetch<Paginated<Order>>(`/orders?page=${page}&perPage=${perPage}`),
    enabled: Boolean(accessToken),
  });
}

export function useOrder(id: string | null) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<Order>({
    queryKey: ['order', id, accessToken],
    queryFn: () => apiFetch<Order>(`/orders/${id}`),
    enabled: Boolean(accessToken) && Boolean(id),
  });
}
