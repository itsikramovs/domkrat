'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { Cart } from '@/lib/types';

const cartKey = ['cart'];

export function useCart() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<Cart>({
    queryKey: [...cartKey, accessToken],
    queryFn: () => apiFetch<Cart>('/cart'),
    enabled: Boolean(accessToken),
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId?: string; offerId?: string; quantity: number }) =>
      apiFetch<Cart>('/cart/items', { method: 'POST', body: input }),
    onSuccess: (data) => qc.setQueryData(cartKey, data),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; quantity: number }) =>
      apiFetch<Cart>(`/cart/items/${input.id}`, {
        method: 'PATCH',
        body: { quantity: input.quantity },
      }),
    onSuccess: (data) => qc.setQueryData(cartKey, data),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Cart>(`/cart/items/${id}`, { method: 'DELETE' }),
    onSuccess: (data) => qc.setQueryData(cartKey, data),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Cart>('/cart', { method: 'DELETE' }),
    onSuccess: (data) => qc.setQueryData(cartKey, data),
  });
}

export function useApplyPromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiFetch<Cart>('/cart/promo', { method: 'POST', body: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cartKey }),
  });
}

export function useRemovePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Cart>('/cart/promo', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: cartKey }),
  });
}
