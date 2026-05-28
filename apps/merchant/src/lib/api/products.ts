'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { MultiLangText, Paginated, Product } from '@/lib/types';

export type ProductStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'REJECTED'
  | 'OUT_OF_STOCK';

export interface ProductListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
}

export function useMyProducts(query: ProductListQuery = {}) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['merchant-products', query, t],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set('page', String(query.page ?? 1));
      qs.set('perPage', String(query.perPage ?? 24));
      if (query.search) qs.set('search', query.search);
      if (query.categoryId) qs.set('categoryId', query.categoryId);
      return apiFetch<Paginated<Product>>(`/merchant/products?${qs.toString()}`);
    },
    enabled: Boolean(t),
  });
}

export interface ProductCompatibility {
  id: string;
  carMakeId: string | null;
  carModelId: string | null;
  carModificationId: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  notes: string | null;
  carMake: { id: string; name: string } | null;
  carModel: { id: string; name: string; make: { name: string } } | null;
  carModification: {
    id: string;
    name: string;
    generation: { name: string; model: { name: string; make: { name: string } } };
  } | null;
}

export interface MerchantProduct extends Product {
  compatibilities?: ProductCompatibility[];
  oemCodes?: Array<{ oemNumber: string; manufacturer: string | null; isPrimary: boolean }>;
}

export function useMerchantProduct(id: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['merchant-product', id, t],
    queryFn: () => apiFetch<MerchantProduct>(`/merchant/products/${id}`),
    enabled: Boolean(t) && Boolean(id),
  });
}

export interface CreateProductInput {
  name: MultiLangText;
  sku: string;
  slug?: string;
  categoryId: string;
  brandId?: string;
  description?: { ru?: string; uz?: string };
  oemNumber?: string;
  weight?: number;
  price: number;
  compareAtPrice?: number;
  vatRate?: number;
  status?: ProductStatus;
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductInput) =>
      apiFetch<Product>('/merchant/products', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-products'] });
    },
  });
}

export type UpdateProductInput = Partial<CreateProductInput>;

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProductInput) =>
      apiFetch<Product>(`/merchant/products/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-product', id] });
      void qc.invalidateQueries({ queryKey: ['merchant-products'] });
    },
  });
}

export function useUpdateProductStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: ProductStatus) =>
      apiFetch<Product>(`/merchant/products/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-product', id] });
      void qc.invalidateQueries({ queryKey: ['merchant-products'] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/merchant/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-products'] });
    },
  });
}

// ----- compatibility -----

export function useProductCompatibility(id: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['merchant-product-compat', id, t],
    queryFn: () => apiFetch<ProductCompatibility[]>(`/merchant/products/${id}/compatibility`),
    enabled: Boolean(t) && Boolean(id),
  });
}

export interface AddCompatInput {
  carMakeId?: string;
  carModelId?: string;
  carModificationId?: string;
  yearFrom?: number;
  yearTo?: number;
  notes?: string;
}

export function useAddProductCompat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddCompatInput) =>
      apiFetch<ProductCompatibility>(`/merchant/products/${id}/compatibility`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-product-compat', id] });
    },
  });
}

export function useRemoveProductCompat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (compatId: string) =>
      apiFetch(`/merchant/products/${id}/compatibility/${compatId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-product-compat', id] });
    },
  });
}
