'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { Paginated } from '@/lib/types';

export interface AdminMerchant {
  id: string;
  brandName: string;
  legalName: string;
  slug: string;
  merchantType: 'TYPE_1' | 'TYPE_2';
  status: string;
  verificationStatus: string;
  taxId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  commissionRate: string | null;
  createdAt: string;
  user: {
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  balance: {
    availableBalance: string;
    pendingBalance: string;
    totalEarned: string;
    totalWithdrawn: string;
  } | null;
  _count: { products: number; documents: number };
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  placedAt: string;
  paidAt: string | null;
  _count: { items: number };
}

export interface FinanceDashboard {
  orders: { total: number; paid: number; shipped: number; completed: number };
  revenue: { gross: string };
  merchants: { total: number; active: number };
  pendingWithdrawals: number;
}

export interface AdminWithdrawal {
  id: string;
  requestNumber: string;
  merchantId: string;
  amount: string;
  status: string;
  bankAccount: string;
  bankName: string;
  recipientName: string;
  notes: string | null;
  rejectionReason: string | null;
  externalTransactionId: string | null;
  requestedAt: string;
  processedAt: string | null;
  merchant: { brandName: string; slug: string; contactEmail: string | null };
}

export function useFinanceDashboard() {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery<FinanceDashboard>({
    queryKey: ['admin-dashboard', t],
    queryFn: () => apiFetch('/admin/finance/dashboard'),
    enabled: Boolean(t),
  });
}

export function useAdminMerchants(
  filter: { status?: string; verificationStatus?: string; search?: string } = {},
) {
  const t = useAuthStore((s) => s.accessToken);
  const qs = new URLSearchParams();
  if (filter.status) qs.set('status', filter.status);
  if (filter.verificationStatus) qs.set('verificationStatus', filter.verificationStatus);
  if (filter.search) qs.set('search', filter.search);
  return useQuery<Paginated<AdminMerchant>>({
    queryKey: ['admin-merchants', filter, t],
    queryFn: () => apiFetch(`/admin/merchants?${qs.toString()}`),
    enabled: Boolean(t),
  });
}

export function useApproveMerchant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiFetch(`/admin/merchants/${id}/approve`, { method: 'POST', body: { notes } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-merchants'] }),
  });
}

export function useRejectMerchant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/admin/merchants/${id}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-merchants'] }),
  });
}

export function useSuspendMerchant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/merchants/${id}/suspend`, { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-merchants'] }),
  });
}

export interface CreateMerchantInput {
  ownerEmail: string;
  ownerPassword: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhone?: string;
  merchantType: 'TYPE_1' | 'TYPE_2';
  legalType: 'INDIVIDUAL' | 'LLC' | 'IE' | 'OTHER';
  legalName: string;
  brandName: string;
  slug?: string;
  contactPhone?: string;
  contactEmail?: string;
  taxId?: string;
}

export function useCreateMerchant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMerchantInput) =>
      apiFetch('/admin/merchants', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-merchants'] }),
  });
}

export function useAdminOrders(filter: { status?: string; search?: string } = {}) {
  const t = useAuthStore((s) => s.accessToken);
  const qs = new URLSearchParams();
  if (filter.status) qs.set('status', filter.status);
  if (filter.search) qs.set('search', filter.search);
  return useQuery<Paginated<AdminOrder>>({
    queryKey: ['admin-orders', filter, t],
    queryFn: () => apiFetch(`/admin/orders?${qs.toString()}`),
    enabled: Boolean(t),
  });
}

export interface AdminOrderDetail extends AdminOrder {
  subtotal: string;
  vatAmount: string;
  deliveryCost: string;
  discountAmount: string;
  paymentMethod: string;
  deliveryMethod: string;
  customerNotes: string | null;
  cancellationReason: string | null;
  deliveryAddressSnapshot: Record<string, unknown> | null;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    productSnapshot: { name?: { ru?: string }; sku?: string };
    product: { name: { ru: string }; slug: string } | null;
  }>;
  subOrders: Array<{
    id: string;
    subOrderNumber: string;
    status: string;
    subtotal: string;
    merchantPayout: string;
    commissionAmount: string;
    merchant: { brandName: string; slug: string };
  }>;
  payments: Array<{
    id: string;
    amount: string;
    status: string;
    provider: string;
    createdAt: string;
  }>;
  statusHistory: Array<{
    id: string | number;
    fromStatus: string;
    toStatus: string;
    reason: string | null;
    changedByRole: string | null;
    createdAt: string;
  }>;
}

export function useAdminOrder(id: string | null) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery<AdminOrderDetail>({
    queryKey: ['admin-order', id, t],
    queryFn: () => apiFetch(`/admin/orders/${id}`),
    enabled: Boolean(t && id),
  });
}

export function useUpdateOrderStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      apiFetch(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status, reason } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-order', id] });
      void qc.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
}

export function useAdminWithdrawals(status?: string) {
  const t = useAuthStore((s) => s.accessToken);
  return useQuery<Paginated<AdminWithdrawal>>({
    queryKey: ['admin-withdrawals', status, t],
    queryFn: () => apiFetch(`/admin/finance/withdrawals${status ? `?status=${status}` : ''}`),
    enabled: Boolean(t),
  });
}

export function useApproveWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiFetch(`/admin/finance/withdrawals/${id}/approve`, { method: 'POST', body: { notes } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-withdrawals'] }),
  });
}

export function useRejectWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/admin/finance/withdrawals/${id}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-withdrawals'] }),
  });
}

export function useCompleteWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, externalTransactionId }: { id: string; externalTransactionId: string }) =>
      apiFetch(`/admin/finance/withdrawals/${id}/complete`, {
        method: 'POST',
        body: { externalTransactionId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-withdrawals'] }),
  });
}
