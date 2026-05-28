'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface NotificationItem {
  id: string;
  templateCode: string;
  channel: 'SMS' | 'EMAIL' | 'PUSH' | 'IN_APP';
  subject: string | null;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: NotificationItem[];
  meta: { page: number; perPage: number; total: number; unreadCount: number };
}

export function useNotifications(unreadOnly = false) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', unreadOnly, token],
    queryFn: () =>
      apiFetch<NotificationsResponse>(
        `/me/notifications?perPage=50${unreadOnly ? '&unreadOnly=true' : ''}`,
      ),
    enabled: Boolean(token),
  });
}

export function useUnreadCount() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<{ count: number }>({
    queryKey: ['notifications-unread', token],
    queryFn: () => apiFetch<{ count: number }>('/me/notifications/unread-count'),
    enabled: Boolean(token),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/me/notifications/mark-all-read', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}
