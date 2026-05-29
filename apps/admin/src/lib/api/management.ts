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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
    },
  });
}

// ====================== Системные пользователи (staff) ======================
export type StaffRole =
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'CONTENT_MANAGER'
  | 'SUPPORT_AGENT'
  | 'FINANCE_MANAGER'
  | 'WAREHOUSE_MANAGER'
  | 'WAREHOUSE_WORKER'
  | 'COURIER';

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Супер-админ',
  ADMIN: 'Администратор',
  CONTENT_MANAGER: 'Контент-менеджер',
  SUPPORT_AGENT: 'Поддержка',
  FINANCE_MANAGER: 'Финансы',
  WAREHOUSE_MANAGER: 'Менеджер склада',
  WAREHOUSE_WORKER: 'Кладовщик',
  COURIER: 'Курьер',
};

export function useStaff(filter: { role?: string; search?: string } = {}) {
  const t = useTok();
  const qs = new URLSearchParams();
  if (filter.role) qs.set('role', filter.role);
  if (filter.search) qs.set('search', filter.search);
  return useQuery({
    queryKey: ['admin-staff', filter, t],
    queryFn: () => apiFetch<Paginated<AdminUser>>(`/admin/staff?${qs.toString()}`),
    enabled: Boolean(t),
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      email: string;
      password: string;
      role: StaffRole;
      firstName?: string;
      lastName?: string;
    }) => apiFetch('/admin/staff', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
  });
}

export function useSetStaffRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: StaffRole[] }) =>
      apiFetch(`/admin/staff/${id}/roles`, { method: 'PATCH', body: { roles } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
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

// ============================ Характеристики ============================
export type AttributeDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM';

export interface AttributeEnumValue {
  value: string;
  label: ML;
}

export interface AdminAttributeGroup {
  id: string;
  name: ML;
  slug: string;
  position: number;
  _count?: { attributes: number };
}

export interface AdminAttribute {
  id: string;
  name: ML;
  slug: string;
  code: string | null;
  dataType: AttributeDataType;
  unit: string | null;
  isFilterable: boolean;
  isSearchable: boolean;
  isRequired: boolean;
  position: number;
  attributeGroupId: string | null;
  categoryIds: string[];
  enumValues: AttributeEnumValue[] | null;
  group?: { id: string; name: ML; slug: string } | null;
  _count?: { productAttributes: number };
}

export function useAttributeGroups() {
  const t = useTok();
  return useQuery({
    queryKey: ['admin-attr-groups', t],
    queryFn: () => apiFetch<AdminAttributeGroup[]>('/admin/attribute-groups'),
    enabled: Boolean(t),
  });
}

export function useSaveAttributeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? apiFetch(`/admin/attribute-groups/${id}`, { method: 'PATCH', body })
        : apiFetch('/admin/attribute-groups', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-attr-groups'] }),
  });
}

export function useDeleteAttributeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/attribute-groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-attr-groups'] });
      qc.invalidateQueries({ queryKey: ['admin-attributes'] });
    },
  });
}

export function useAttributes(groupId?: string) {
  const t = useTok();
  return useQuery({
    queryKey: ['admin-attributes', groupId, t],
    queryFn: () =>
      apiFetch<AdminAttribute[]>(`/admin/attributes${groupId ? `?groupId=${groupId}` : ''}`),
    enabled: Boolean(t),
  });
}

export function useSaveAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? apiFetch(`/admin/attributes/${id}`, { method: 'PATCH', body })
        : apiFetch('/admin/attributes', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-attributes'] }),
  });
}

export function useDeleteAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/attributes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-attributes'] }),
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
