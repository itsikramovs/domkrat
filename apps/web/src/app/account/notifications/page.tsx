'use client';

import { Bell, Check, CheckCheck, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationItem,
} from '@/lib/api/notifications';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const CHANNEL_ICONS = {
  SMS: MessageSquare,
  EMAIL: Mail,
  PUSH: Smartphone,
  IN_APP: Bell,
} as const;

export default function NotificationsPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = useNotifications(unreadOnly);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  useEffect(() => {
    if (accessToken === null) router.push('/login?next=/account/notifications');
  }, [accessToken, router]);
  if (!accessToken) return null;

  const onMarkAll = async () => {
    try {
      const res = await markAll.mutateAsync();
      toast.success(`Отмечено ${(res as { count: number }).count} уведомлений`);
    } catch {
      toast.error('Не удалось');
    }
  };

  return (
    <div className="space-y-4 px-4 py-6 md:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Уведомления</h1>
        {notifications.data && notifications.data.meta.unreadCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAll}
            disabled={markAll.isPending}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Все прочитаны
          </button>
        ) : null}
      </div>

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setUnreadOnly(false)}
          className={cn(
            'rounded-full px-3 py-1.5 font-medium',
            !unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
          )}
        >
          Все · {notifications.data?.meta.total ?? 0}
        </button>
        <button
          type="button"
          onClick={() => setUnreadOnly(true)}
          className={cn(
            'rounded-full px-3 py-1.5 font-medium',
            unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
          )}
        >
          Непрочитанные · {notifications.data?.meta.unreadCount ?? 0}
        </button>
      </div>

      {notifications.isLoading ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : notifications.data && notifications.data.data.length > 0 ? (
        <ul className="space-y-2">
          {notifications.data.data.map((n) => (
            <Item key={n.id} n={n} onRead={() => markRead.mutate(n.id)} />
          ))}
        </ul>
      ) : (
        <div className="space-y-3 rounded-2xl bg-card p-8 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {unreadOnly
              ? 'Все уведомления прочитаны 🎉'
              : 'У вас пока нет уведомлений.'}
          </p>
        </div>
      )}
    </div>
  );
}

function Item({ n, onRead }: { n: NotificationItem; onRead: () => void }) {
  const Icon = CHANNEL_ICONS[n.channel] ?? Bell;
  const unread = !n.readAt;
  const date = new Date(n.createdAt);
  return (
    <li
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        unread ? 'border-primary/30 bg-accent/30' : 'border-border bg-card',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            unread ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {n.subject ?? n.templateCode.replace(/_/g, ' ')}
            </h3>
            <time className="shrink-0 text-[11px] text-muted-foreground">
              {date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground line-clamp-3">{n.body}</p>
        </div>
        {unread ? (
          <button
            type="button"
            onClick={onRead}
            aria-label="Отметить прочитанным"
            className="text-muted-foreground hover:text-primary"
          >
            <Check className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
