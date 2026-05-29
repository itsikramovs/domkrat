'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import type { Brand, Category, MultiLangText } from '@/lib/types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Category[]>('/categories'),
    staleTime: 5 * 60_000,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => apiFetch<Brand[]>('/brands'),
    staleTime: 5 * 60_000,
  });
}

export type AttributeDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM';

export interface CategoryAttribute {
  id: string;
  name: MultiLangText;
  slug: string;
  dataType: AttributeDataType;
  unit: string | null;
  isRequired: boolean;
  isFilterable: boolean;
  position: number;
  enumValues: Array<{ value: string; label: MultiLangText }> | null;
  group: { id: string; name: MultiLangText; slug: string; position: number } | null;
}

/** Характеристики, применимые к выбранной категории (с учётом родительских категорий). */
export function useCategoryAttributes(categoryId: string | null | undefined) {
  return useQuery({
    queryKey: ['category-attributes', categoryId],
    queryFn: () => apiFetch<CategoryAttribute[]>(`/categories/${categoryId}/attributes`),
    enabled: Boolean(categoryId),
    staleTime: 60_000,
  });
}
