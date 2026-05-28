'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface AnalyticsSummary {
  rangeDays: number;
  orders: {
    total: number;
    paid: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    gross: string;
    payout: string;
    commission: string;
  };
  averageCheck: string;
  topProducts: Array<{
    productId: string;
    name: unknown;
    quantitySold: number;
    revenue: string;
  }>;
  dailyRevenue: Array<{ date: string; orders: number; revenue: string }>;
  inventory: {
    totalProducts: number;
    activeProducts: number;
    outOfStock: number;
  };
}

export function useAnalyticsSummary(range: number = 30) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['merchant', 'analytics', 'summary', range],
    queryFn: () =>
      apiFetch<AnalyticsSummary>(`/merchant/analytics/summary?range=${range}`, { token }),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
}
