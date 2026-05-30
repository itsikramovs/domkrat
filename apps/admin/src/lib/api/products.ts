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

export interface AdminVariant {
  id: string;
  name: ML | null;
  barcode: string | null;
  position: number;
  isDefault: boolean;
}

export interface AdminOffer {
  id: string;
  variantId: string;
  merchantId: string;
  sku: string;
  price: string;
  compareAtPrice: string | null;
  vatRate: string;
  status: string;
  stock: number;
  reserved: number;
  merchant: { id: string; brandName: string };
  variant: { id: string; name: ML | null; isDefault: boolean };
}

export interface AdminProductDetail {
  id: string;
  sku: string | null;
  slug: string;
  name: ML;
  description: ML | null;
  price: string;
  compareAtPrice: string | null;
  vatRate: string;
  minPrice: string | null;
  status: string;
  oemNumber: string | null;
  barcode: string | null;
  weight: string | null;
  categoryId: string;
  brandId: string | null;
  category: { id: string; name: ML; slug: string };
  brand: { id: string; name: string } | null;
  merchant: { id: string; brandName: string } | null;
  offersCount: number;
  sellerCount: number;
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  attributes: AdminProductAttr[];
  variants: AdminVariant[];
  offers: AdminOffer[];
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
      offerId?: string;
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

// -------- Variants --------
export function useProductVariants(id: string) {
  const t = useTok();
  return useQuery<AdminVariant[]>({
    queryKey: ['admin-product-variants', id, t],
    queryFn: () => apiFetch(`/admin/products/${id}/variants`),
    enabled: Boolean(t && id),
  });
}

export interface VariantBody {
  name?: { ru?: string; uz?: string } | null;
  barcode?: string;
  position?: number;
  isDefault?: boolean;
}

export function useCreateVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VariantBody) =>
      apiFetch(`/admin/products/${productId}/variants`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', productId] }),
  });
}

export function useUpdateVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, body }: { variantId: string; body: VariantBody }) =>
      apiFetch(`/admin/products/${productId}/variants/${variantId}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', productId] }),
  });
}

export function useSetDefaultVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) =>
      apiFetch(`/admin/products/${productId}/variants/${variantId}/default`, {
        method: 'PATCH',
        body: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', productId] }),
  });
}

export function useDeleteVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) =>
      apiFetch(`/admin/products/${productId}/variants/${variantId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', productId] }),
  });
}

// -------- Offers (multi-seller) --------
export interface OfferBody {
  variantId: string;
  merchantId: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  vatRate?: number;
}

export function useCreateOffer(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OfferBody) =>
      apiFetch(`/admin/products/${productId}/offers`, { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-product', productId] });
      void qc.invalidateQueries({ queryKey: ['admin-mod-products'] });
    },
  });
}

export function useUpdateOffer(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      offerId,
      body,
    }: {
      offerId: string;
      body: Partial<Pick<OfferBody, 'sku' | 'price' | 'compareAtPrice' | 'vatRate'>>;
    }) => apiFetch(`/admin/products/offers/${offerId}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-product', productId] });
      void qc.invalidateQueries({ queryKey: ['admin-mod-products'] });
    },
  });
}

export function useSetOfferStatus(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, status }: { offerId: string; status: string }) =>
      apiFetch(`/admin/products/offers/${offerId}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', productId] }),
  });
}

export function useDeleteOffer(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) =>
      apiFetch(`/admin/products/offers/${offerId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-product', productId] });
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

// -------- Product images (admin) --------
/** Presign в MinIO + PUT файла. Возвращает публичный URL. */
export async function uploadProductImage(productId: string, file: File): Promise<string> {
  const presign = await apiFetch<{ uploadUrl: string; publicUrl: string }>(
    '/uploads/presign-product-image',
    { method: 'POST', body: { productId, contentType: file.type, filename: file.name } },
  );
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Загрузка не удалась: ${put.status}`);
  return presign.publicUrl;
}

export function useAddProductImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; isPrimary?: boolean }) =>
      apiFetch(`/admin/products/${id}/images`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', id] }),
  });
}

export function useRemoveProductImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      apiFetch(`/admin/products/${id}/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', id] }),
  });
}

export function useSetPrimaryImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      apiFetch(`/admin/products/${id}/images/${imageId}/primary`, { method: 'PATCH', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', id] }),
  });
}

// -------- Multi-line приёмка (по предложениям) --------
export interface BatchReceiveItem {
  offerId: string;
  cellId: string;
  quantity: number;
  unitCost?: number;
}

export function useReceiveBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { warehouseId: string; items: BatchReceiveItem[] }) =>
      apiFetch('/admin/products/receive-batch', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-mod-products'] }),
  });
}

export interface AdminProductListItem {
  id: string;
  sku: string | null;
  name: ML;
  status: string;
  price: string;
  offers: Array<{ id: string; merchantId: string; sku: string; price: string }>;
}

export function useAdminProductList(filter: {
  merchantId?: string;
  status?: string;
  search?: string;
}) {
  const t = useTok();
  const qs = new URLSearchParams();
  if (filter.merchantId) qs.set('merchantId', filter.merchantId);
  if (filter.status) qs.set('status', filter.status);
  if (filter.search) qs.set('search', filter.search);
  qs.set('perPage', '100');
  return useQuery({
    queryKey: ['admin-product-list', filter, t],
    queryFn: () => apiFetch<{ data: AdminProductListItem[] }>(`/admin/products?${qs.toString()}`),
    enabled: Boolean(t && filter.merchantId),
  });
}
