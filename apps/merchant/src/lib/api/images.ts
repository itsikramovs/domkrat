'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface ProductImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  isPrimary: boolean;
  position: number;
  width: number | null;
  height: number | null;
  fileSize: number | null;
}

export function useProductImages(productId: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['merchant-product-images', productId, t],
    queryFn: () => apiFetch<ProductImage[]>(`/merchant/products/${productId}/images`),
    enabled: Boolean(t) && Boolean(productId),
  });
}

interface PresignResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
}

export async function presignAndUpload(productId: string, file: File): Promise<{ url: string }> {
  const presign = await apiFetch<PresignResponse>('/uploads/presign-product-image', {
    method: 'POST',
    body: { productId, contentType: file.type, filename: file.name },
  });
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload to MinIO failed: ${put.status}`);
  }
  return { url: presign.publicUrl };
}

export function useAddProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { url } = await presignAndUpload(productId, file);
      return apiFetch<ProductImage>(`/merchant/products/${productId}/images`, {
        method: 'POST',
        body: { url, fileSize: file.size },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-product-images', productId] });
      void qc.invalidateQueries({ queryKey: ['merchant-product', productId] });
    },
  });
}

export function useRemoveProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      apiFetch(`/merchant/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-product-images', productId] });
      void qc.invalidateQueries({ queryKey: ['merchant-product', productId] });
    },
  });
}

export function useSetPrimaryImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      apiFetch(`/merchant/products/${productId}/images/${imageId}/primary`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merchant-product-images', productId] });
      void qc.invalidateQueries({ queryKey: ['merchant-product', productId] });
    },
  });
}
