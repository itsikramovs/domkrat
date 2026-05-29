'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface MultiLang {
  ru: string;
  uz: string;
}

export interface AdminWarehouse {
  id: string;
  code: string;
  name: MultiLang;
  type: 'PLATFORM' | 'MERCHANT' | 'PARTNER';
  city: string | null;
  merchantId: string | null;
  isActive: boolean;
  _count?: { zones: number; inventoryBalances: number; stockReceipts: number };
}

export interface AdminCell {
  id: string;
  code: string;
  cellType: string;
  _count?: { inventoryBalances: number };
}

export function useAdminWarehouses(type?: string) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['admin-wh', type, t],
    queryFn: () => apiFetch<AdminWarehouse[]>(`/admin/warehouses${type ? `?type=${type}` : ''}`),
    enabled: Boolean(t),
  });
}

export function useAdminWarehouseCells(id: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['admin-wh-cells', id, t],
    queryFn: () => apiFetch<AdminCell[]>(`/admin/warehouses/${id}/cells`),
    enabled: Boolean(t) && Boolean(id),
  });
}

export function useCreatePlatformWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { code: string; name: MultiLang; city?: string }) =>
      apiFetch('/admin/warehouses', { method: 'POST', body: { ...b, type: 'PLATFORM' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-wh'] }),
  });
}

export function useAdminQuickCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ warehouseId, code }: { warehouseId: string; code: string }) =>
      apiFetch(`/admin/warehouses/${warehouseId}/quick-cell`, { method: 'POST', body: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-wh-cells'] }),
  });
}
