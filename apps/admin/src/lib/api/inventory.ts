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

export interface AdminAlert {
  id: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: MultiLang;
  product: { sku: string; name: MultiLang };
  merchant: { brandName: string };
}

export interface AdminReceipt {
  id: string;
  receiptNumber: string;
  status: string;
  totalQuantity: number;
  createdAt: string;
  warehouse: { code: string } | null;
  merchant: { brandName: string } | null;
  _count?: { items: number };
}

export function useAdminAlerts() {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['admin-alerts', t],
    queryFn: () => apiFetch<AdminAlert[]>('/admin/inventory/alerts'),
    enabled: Boolean(t),
  });
}

export function useAdminReceipts() {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['admin-receipts', t],
    queryFn: () => apiFetch<AdminReceipt[]>('/admin/inventory/receipts'),
    enabled: Boolean(t),
  });
}

export function useRunScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/admin/inventory/alerts/scan', { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-alerts'] }),
  });
}

// --- Инвентаризация ---
export interface StockCountItem {
  id: string;
  cellCode: string;
  sku: string;
  productName: MultiLang | null;
  expectedQty: number;
  countedQty: number | null;
}
export interface StockCount {
  id: string;
  warehouseId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  items?: StockCountItem[];
  _count?: { items: number };
}

export function useStockCounts() {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['admin-counts', t],
    queryFn: () => apiFetch<StockCount[]>('/admin/inventory/counts'),
    enabled: Boolean(t),
  });
}
export function useStockCount(id: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['admin-count', id, t],
    queryFn: () => apiFetch<StockCount>(`/admin/inventory/counts/${id}`),
    enabled: Boolean(t) && Boolean(id),
  });
}
export function useCreateStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { warehouseId: string; note?: string }) =>
      apiFetch<StockCount>('/admin/inventory/counts', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-counts'] }),
  });
}
export function useSaveStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; items: Array<{ itemId: string; countedQty: number }> }) =>
      apiFetch<StockCount>(`/admin/inventory/counts/${input.id}/save`, {
        method: 'POST',
        body: { items: input.items },
      }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['admin-count', v.id] }),
  });
}
export function useCompleteStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<StockCount>(`/admin/inventory/counts/${id}/complete`, { method: 'POST', body: {} }),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ['admin-count', id] });
      void qc.invalidateQueries({ queryKey: ['admin-counts'] });
      void qc.invalidateQueries({ queryKey: ['admin-alerts'] });
    },
  });
}
