'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

type ML = { ru: string; uz: string };
const useTok = () => useAuthStore((s) => s.accessToken);

export type AttributeDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM';

export interface CategoryAttribute {
  id: string;
  name: ML;
  slug: string;
  dataType: AttributeDataType;
  unit: string | null;
  isRequired: boolean;
  position: number;
  enumValues: Array<{ value: string; label: ML }> | null;
  group: { id: string; name: ML; position: number } | null;
}

export function useCategoryAttributes(categoryId: string | null | undefined) {
  return useQuery({
    queryKey: ['cat-attributes', categoryId],
    queryFn: () => apiFetch<CategoryAttribute[]>(`/categories/${categoryId}/attributes`),
    enabled: Boolean(categoryId),
    staleTime: 60_000,
  });
}

export interface ProductAttrValue {
  attributeId: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueEnum?: string;
  valueMultiEnum?: string[];
}

export interface AdminProductAttr {
  attributeId: string;
  valueString: string | null;
  valueNumber: string | null;
  valueBoolean: boolean | null;
  valueEnum: string | null;
  valueMultiEnum: string[];
  attribute: {
    id: string;
    name: ML;
    slug: string;
    dataType: AttributeDataType;
    unit: string | null;
  };
}

export interface AdminProductDetail {
  id: string;
  sku: string;
  slug: string;
  name: ML;
  description: ML | null;
  price: string;
  compareAtPrice: string | null;
  vatRate: string;
  status: string;
  oemNumber: string | null;
  barcode: string | null;
  weight: string | null;
  categoryId: string;
  brandId: string | null;
  category: { id: string; name: ML; slug: string };
  brand: { id: string; name: string } | null;
  merchant: { id: string; brandName: string };
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  attributes: AdminProductAttr[];
  inventoryBalances: Array<{ quantityAvailable: number }>;
}

export interface CreateProductBody {
  merchantId: string;
  categoryId: string;
  brandId?: string;
  name: ML;
  sku: string;
  price: number;
  compareAtPrice?: number;
  vatRate?: number;
  oemNumber?: string;
  barcode?: string;
  weight?: number;
  description?: { ru?: string; uz?: string };
  attributes?: ProductAttrValue[];
}

export function useAdminProduct(id: string | null) {
  const t = useTok();
  return useQuery<AdminProductDetail>({
    queryKey: ['admin-product', id, t],
    queryFn: () => apiFetch(`/admin/products/${id}`),
    enabled: Boolean(t && id),
  });
}

export function useCreateAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductBody) =>
      apiFetch<AdminProductDetail>('/admin/products', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-mod-products'] }),
  });
}

export function useUpdateAdminProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateProductBody>) =>
      apiFetch<AdminProductDetail>(`/admin/products/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-product', id] });
      void qc.invalidateQueries({ queryKey: ['admin-mod-products'] });
    },
  });
}

export function useReceiveProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      warehouseId: string;
      cellId: string;
      quantity: number;
      unitCost?: number;
    }) => apiFetch(`/admin/products/${id}/receive`, { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-product', id] });
      void qc.invalidateQueries({ queryKey: ['admin-mod-products'] });
    },
  });
}

// -------- Warehouses & cells (for приход) --------
export interface AdminWarehouse {
  id: string;
  code: string;
  name: ML;
  type: string;
  merchantId: string | null;
}

export function useAdminWarehouses() {
  const t = useTok();
  return useQuery<AdminWarehouse[]>({
    queryKey: ['admin-warehouses', t],
    queryFn: () => apiFetch('/admin/warehouses'),
    enabled: Boolean(t),
  });
}

export interface WarehouseCell {
  id: string;
  code: string;
  isBlocked: boolean;
  isActive: boolean;
  merchantId: string | null;
}

export function useWarehouseCells(warehouseId: string | null) {
  const t = useTok();
  return useQuery<WarehouseCell[]>({
    queryKey: ['admin-wh-cells', warehouseId, t],
    queryFn: () => apiFetch(`/admin/warehouses/${warehouseId}/cells`),
    enabled: Boolean(t && warehouseId),
  });
}

export function useQuickAddCell(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<WarehouseCell>(`/admin/warehouses/${warehouseId}/quick-cell`, {
        method: 'POST',
        body: { code },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-wh-cells', warehouseId] }),
  });
}
