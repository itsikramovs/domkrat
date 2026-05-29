'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminOrders } from '@/lib/api/admin';
import { formatPrice } from '@/lib/utils';

const STATUSES = [
  'CREATED',
  'PAID',
  'PROCESSING',
  'ASSEMBLED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
];

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Создан',
  PAID: 'Оплачен',
  PROCESSING: 'В обработке',
  ASSEMBLED: 'Собран',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

export default function AdminOrdersPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const params = useSearchParams();
  const status = params.get('status') ?? undefined;
  const orders = useAdminOrders({ status });

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold">Заказы платформы</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href="/orders"
          className={`px-3 py-1 rounded border ${!status ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
        >
          Все
        </a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/orders?status=${s}`}
            className={`px-3 py-1 rounded border ${status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            {s}
          </a>
        ))}
      </div>

      {orders.isLoading || !orders.data ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-3">
          {orders.data.data.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="block">
              <Card className="transition-colors hover:border-primary/50 hover:bg-accent/40">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-mono font-semibold">{o.orderNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.placedAt).toLocaleString('ru-RU')} · {o._count.items} позиций
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.customerName} · {o.customerPhone ?? o.customerEmail ?? '—'}
                    </div>
                  </div>
                  <Badge
                    variant={
                      o.status === 'COMPLETED' || o.status === 'PAID'
                        ? 'success'
                        : o.status === 'CANCELLED'
                          ? 'destructive'
                          : 'default'
                    }
                  >
                    {STATUS_LABELS[o.status] ?? o.status}
                  </Badge>
                  <Badge variant={o.paymentStatus === 'PAID' ? 'success' : 'secondary'}>
                    {o.paymentStatus}
                  </Badge>
                  <div className="font-bold">{formatPrice(o.totalAmount)}</div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
          {orders.data.data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Заказов не найдено</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
