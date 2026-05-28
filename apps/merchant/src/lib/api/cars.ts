'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';

export interface CarMake {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isPopular: boolean;
}

export interface CarModel {
  id: string;
  name: string;
  slug: string;
  bodyType: string | null;
  imageUrl: string | null;
}

export interface CarGeneration {
  id: string;
  name: string;
  yearFrom: number;
  yearTo: number | null;
  restylingYear: number | null;
}

export interface CarModification {
  id: string;
  name: string;
  transmission: string | null;
  driveType: string | null;
  horsepower: number | null;
  fuelType: string | null;
  engine: { name: string; displacement: string | null } | null;
}

export function useCarMakes(onlyPopular = false) {
  return useQuery({
    queryKey: ['car-makes', onlyPopular],
    queryFn: () => apiFetch<CarMake[]>(`/cars/makes${onlyPopular ? '?popular=true' : ''}`),
    staleTime: 5 * 60_000,
  });
}

export function useCarModels(makeId: string | null) {
  return useQuery({
    queryKey: ['car-models', makeId],
    queryFn: () => apiFetch<CarModel[]>(`/cars/makes/${makeId}/models`),
    enabled: Boolean(makeId),
    staleTime: 5 * 60_000,
  });
}

export function useCarGenerations(modelId: string | null) {
  return useQuery({
    queryKey: ['car-generations', modelId],
    queryFn: () => apiFetch<CarGeneration[]>(`/cars/models/${modelId}/generations`),
    enabled: Boolean(modelId),
    staleTime: 5 * 60_000,
  });
}

export function useCarModifications(generationId: string | null) {
  return useQuery({
    queryKey: ['car-modifications', generationId],
    queryFn: () => apiFetch<CarModification[]>(`/cars/generations/${generationId}/modifications`),
    enabled: Boolean(generationId),
    staleTime: 5 * 60_000,
  });
}
