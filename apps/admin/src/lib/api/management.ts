'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { Paginated } from '@/lib/types';

interface ML {
  ru: string;
  uz: string;
}
const useTok = () => useAuthStore((s) => s.accessToken);

// ============================ Пользователи ============================
export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  roles?: { role: string }[];
}

export function useAdminUsers(filter: { role?: string; search?: string } = {}) {
  const t = useTok();
  const qs = new URLSearchParams();
  if (filter.role) qs.set('role', filter.role);
  if (filter.search) qs.set('search', filter.search);
  qs.set('perPage', '50');
  return useQuery({
    queryKey: ['admin-users', filter, t],
    queryFn: () => apiFetch<Paginated<AdminUser>>(`/admin/users?${qs.toString()}`),
    enabled: Boolean(t),
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/admin/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

// ============================ Категории ============================
export interface AdminCategory {
  id: string;
  name: ML;
  slug: string;
  parentId: string | null;
  position: number;
  _count?: { products: number };
}

export function useAdminCategories() {
  const t = useTok();
  return useQuery({
    queryKey: ['admin-categories', t],
    queryFn: () => apiFetch<AdminCategory[]>('/admin/categories'),
    enabled: Boolean(t),
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? apiFetch(`/admin/categories/${id}`, { method: 'PATCH', body })
        : apiFetch('/admin/categories', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  });
}

// ============================ Бренды ============================
export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  countryOfOrigin: string | null;
  _count?: { products: number };
}

export function useAdminBrands() {
  const t = useTok();
  return useQuery({
    queryKey: ['admin-brands', t],
    queryFn: () => apiFetch<AdminBrand[]>('/admin/brands'),
    enabled: Boolean(t),
  });
}

export function useSaveBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? apiFetch(`/admin/brands/${id}`, { method: 'PATCH', body })
        : apiFetch('/admin/brands', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-brands'] }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/brands/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-brands'] }),
  });
}

// ============================ Модерация товаров ============================
export interface AdminProduct {
  id: string;
  sku: string;
  slug: string;
  name: ML;
  price: string;
  status: string;
  merchant?: { brandName: string };
}

export function useModerationProducts(status?: string, search?: string) {
  const t = useTok();
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (search) qs.set('search', search);
  qs.set('perPage', '50');
  return useQuery({
    queryKey: ['admin-mod-products', status, search, t],
    queryFn: () => apiFetch<Paginated<AdminProduct>>(`/admin/products?${qs.toString()}`),
    enabled: Boolean(t),
  });
}

export function useModerateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: 'ACTIVE' | 'REJECTED';
      reason?: string;
    }) => apiFetch(`/admin/products/${id}/moderate`, { method: 'PATCH', body: { status, reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-mod-products'] }),
  });
}

// ============================ Отзывы ============================
export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  createdAt: string;
  user?: { firstName: string | null; lastName: string | null };
  product?: { name: ML; sku: string };
}

export function useAdminReviews(status = 'PENDING') {
  const t = useTok();
  return useQuery({
    queryKey: ['admin-reviews', status, t],
    queryFn: () => apiFetch<Paginated<AdminReview>>(`/admin/reviews?status=${status}`),
    enabled: Boolean(t),
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      apiFetch(`/admin/reviews/${id}/moderate`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });
}

// ============================ Возвраты ============================
export interface AdminReturn {
  id: string;
  returnNumber?: string;
  status: string;
  reason: string | null;
  refundAmount?: string;
  createdAt: string;
  user?: { firstName: string | null; lastName: string | null; email: string | null };
}

export function useAdminReturns(status?: string) {
  const t = useTok();
  return useQuery({
    queryKey: ['admin-returns', status, t],
    queryFn: () =>
      apiFetch<Paginated<AdminReturn>>(`/admin/returns${status ? `?status=${status}` : ''}`),
    enabled: Boolean(t),
  });
}

export function useReturnAction(action: 'approve' | 'reject' | 'complete') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/admin/returns/${id}/${action}`, {
        method: 'POST',
        body: reason ? { reason } : {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-returns'] }),
  });
}

// ============================ Система ============================
export function useRebuildSearch() {
  return useMutation({
    mutationFn: () => apiFetch('/search/rebuild', { method: 'POST', body: {} }),
  });
}

export function useRunHoldRelease() {
  return useMutation({
    mutationFn: () => apiFetch('/admin/finance/hold-release/run', { method: 'POST', body: {} }),
  });
}
