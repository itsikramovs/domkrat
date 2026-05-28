'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface GarageEntry {
  id: string;
  nickname: string | null;
  vin: string | null;
  carModificationId: string | null;
  year: number | null;
  licensePlate: string | null;
  mileage: number | null;
  isPrimary: boolean;
  createdAt: string;
  carModification: {
    id: string;
    name: string;
    transmission: string | null;
    horsepower: number | null;
    fuelType: string | null;
    generation: {
      name: string;
      yearFrom: number;
      yearTo: number | null;
      model: {
        name: string;
        bodyType: string | null;
        make: { name: string; logoUrl: string | null };
      };
    };
    engine: { name: string; displacement: string | null } | null;
  } | null;
}

export function useGarages() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<GarageEntry[]>({
    queryKey: ['garages', token],
    queryFn: () => apiFetch<GarageEntry[]>('/me/garages'),
    enabled: Boolean(token),
  });
}

export interface CreateGarageInput {
  nickname?: string;
  vin?: string;
  carModificationId?: string;
  year?: number;
  licensePlate?: string;
  mileage?: number;
  isPrimary?: boolean;
}

export function useCreateGarage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGarageInput) =>
      apiFetch<GarageEntry>('/me/garages', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['garages'] });
    },
  });
}

export function useUpdateGarage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateGarageInput>) =>
      apiFetch<GarageEntry>(`/me/garages/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['garages'] });
    },
  });
}

export function useDeleteGarage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/me/garages/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['garages'] });
    },
  });
}
