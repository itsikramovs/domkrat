'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { MultiLangText } from '@/lib/types';

export type ReceiptStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'EXPECTED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'CHECKING'
  | 'PLACING'
  | 'COMPLETED'
  | 'REJECTED';

export interface Warehouse {
  id: string;
  code: string;
  name: MultiLangText;
  type: 'PLATFORM' | 'MERCHANT' | 'PARTNER';
  city: string | null;
  isActive: boolean;
  _count?: { zones: number; inventoryBalances: number; stockReceipts: number };
}

export interface WarehouseCell {
  id: string;
  code: string;
  cellType: string;
  isActive: boolean;
  isBlocked: boolean;
  _count?: { inventoryBalances: number };
}

export interface ReceiptItem {
  id: string;
  productId: string;
  expectedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  rejectionReason: string | null;
  unitCost: string | null;
  placedInCells: Record<string, number> | null;
  product?: { sku: string; name: MultiLangText };
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  status: ReceiptStatus;
  qualityCheckStatus: string;
  placementStatus: string;
  totalItems: number;
  totalQuantity: number;
  totalValue: string;
  notes: string | null;
  createdAt: string;
  warehouse?: { id?: string; code: string; name: MultiLangText };
  items?: ReceiptItem[];
  _count?: { items: number };
}

export interface InventoryBalance {
  id: string;
  quantityAvailable: number;
  quantityReserved: number;
  product: { sku: string; name: MultiLangText; slug: string };
  warehouse: { code: string; name: MultiLangText } | null;
  cell: { code: string } | null;
}

export interface StockMovement {
  id: string;
  movementType: string;
  quantity: number;
  performedAt: string;
  product: { sku: string; name: MultiLangText };
  fromCell: { code: string } | null;
  toCell: { code: string } | null;
}

export interface InventorySummary {
  skuCount: number;
  totalAvailable: number;
  totalReserved: number;
  lowStockCount: number;
  activeReceipts: number;
}

const tok = () => useAuthStore((s) => s.accessToken);

// ---------------- Склады ----------------
export function useWarehouses() {
  const t = tok();
  return useQuery({
    queryKey: ['wh', t],
    queryFn: () => apiFetch<Warehouse[]>('/merchant/warehouses'),
    enabled: Boolean(t),
  });
}

export function useWarehouseCells(id: string | null) {
  const t = tok();
  return useQuery({
    queryKey: ['wh-cells', id, t],
    queryFn: () => apiFetch<WarehouseCell[]>(`/merchant/warehouses/${id}/cells`),
    enabled: Boolean(t) && Boolean(id),
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { code: string; name: MultiLangText; city?: string }) =>
      apiFetch('/merchant/warehouses', { method: 'POST', body: { ...b, type: 'MERCHANT' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wh'] }),
  });
}

export function useQuickAddCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ warehouseId, code }: { warehouseId: string; code: string }) =>
      apiFetch(`/merchant/warehouses/${warehouseId}/quick-cell`, {
        method: 'POST',
        body: { code },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wh-cells'] }),
  });
}

// ---------------- Приёмки ----------------
export function useReceipts(status?: ReceiptStatus) {
  const t = tok();
  return useQuery({
    queryKey: ['receipts', status, t],
    queryFn: () => apiFetch<Receipt[]>(`/merchant/receipts${status ? `?status=${status}` : ''}`),
    enabled: Boolean(t),
  });
}

export function useReceipt(id: string | null) {
  const t = tok();
  return useQuery({
    queryKey: ['receipt', id, t],
    queryFn: () => apiFetch<Receipt>(`/merchant/receipts/${id}`),
    enabled: Boolean(t) && Boolean(id),
  });
}

export interface CreateReceiptInput {
  warehouseId: string;
  notes?: string;
  items: { productId: string; expectedQuantity: number; unitCost?: string }[];
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: CreateReceiptInput) =>
      apiFetch('/merchant/receipts', { method: 'POST', body: b }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receipts'] }),
  });
}

function receiptAction<T>(path: string) {
  return function useAction() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, body }: { id: string; body?: T }) =>
        apiFetch(`/merchant/receipts/${id}/${path}`, { method: 'POST', body: body ?? {} }),
      onSuccess: (_d, v) => {
        qc.invalidateQueries({ queryKey: ['receipts'] });
        qc.invalidateQueries({ queryKey: ['receipt', v.id] });
        qc.invalidateQueries({ queryKey: ['inv'] });
      },
    });
  };
}

export const useSubmitReceipt = receiptAction('submit');
export const useReceiveReceipt = receiptAction<{
  items: { itemId: string; receivedQuantity: number }[];
}>('receive');
export const useQualityCheck = receiptAction<{
  items: {
    itemId: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
    rejectionReason?: string;
  }[];
}>('quality-check');
export const usePlaceReceipt = receiptAction<{
  placements: { itemId: string; cellId: string; quantity: number }[];
}>('place');

// ---------------- Остатки / движения ----------------
export function useInventorySummary() {
  const t = tok();
  return useQuery({
    queryKey: ['inv', 'summary', t],
    queryFn: () => apiFetch<InventorySummary>('/merchant/inventory/summary'),
    enabled: Boolean(t),
  });
}

export function useBalances(byCell = false) {
  const t = tok();
  return useQuery({
    queryKey: ['inv', 'balances', byCell, t],
    queryFn: () => apiFetch<InventoryBalance[]>(`/merchant/inventory/balances?byCell=${byCell}`),
    enabled: Boolean(t),
  });
}

export function useMovements() {
  const t = tok();
  return useQuery({
    queryKey: ['inv', 'movements', t],
    queryFn: () => apiFetch<StockMovement[]>('/merchant/inventory/movements'),
    enabled: Boolean(t),
  });
}

// ---------------- Алерты ----------------
export interface InventoryAlert {
  id: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: MultiLangText;
  createdAt: string;
  product: { sku: string; name: MultiLangText };
}

export function useAlerts() {
  const t = tok();
  return useQuery({
    queryKey: ['inv', 'alerts', t],
    queryFn: () => apiFetch<InventoryAlert[]>('/merchant/inventory/alerts'),
    enabled: Boolean(t),
  });
}

export function useAlertAction(action: 'resolve' | 'dismiss') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/merchant/inventory/alerts/${id}/${action}`, { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv', 'alerts'] }),
  });
}

// ---------------- Трансфер между ячейками ----------------
export function useTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: {
      productId: string;
      fromCellId: string;
      toCellId: string;
      quantity: number;
    }) => apiFetch('/merchant/inventory/transfer', { method: 'POST', body: b }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv'] }),
  });
}

// --- Инвентаризация ---
export interface MStockCountItem {
  id: string;
  cellCode: string;
  sku: string;
  productName: MultiLangText | null;
  expectedQty: number;
  countedQty: number | null;
}
export interface MStockCount {
  id: string;
  warehouseId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  items?: MStockCountItem[];
  _count?: { items: number };
}

export function useStockCounts() {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['m-counts', t],
    queryFn: () => apiFetch<MStockCount[]>('/merchant/inventory/counts'),
    enabled: Boolean(t),
  });
}
export function useStockCount(id: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['m-count', id, t],
    queryFn: () => apiFetch<MStockCount>(`/merchant/inventory/counts/${id}`),
    enabled: Boolean(t) && Boolean(id),
  });
}
export function useCreateStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { warehouseId: string; note?: string }) =>
      apiFetch<MStockCount>('/merchant/inventory/counts', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m-counts'] }),
  });
}
export function useSaveStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; items: Array<{ itemId: string; countedQty: number }> }) =>
      apiFetch<MStockCount>(`/merchant/inventory/counts/${input.id}/save`, {
        method: 'POST',
        body: { items: input.items },
      }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['m-count', v.id] }),
  });
}
export function useCompleteStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<MStockCount>(`/merchant/inventory/counts/${id}/complete`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ['m-count', id] });
      void qc.invalidateQueries({ queryKey: ['m-counts'] });
      void qc.invalidateQueries({ queryKey: ['inv'] });
    },
  });
}
