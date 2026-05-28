'use client';

import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { useMerchantOrders, type SubOrderStatus } from '@/lib/api/merchant-orders';

const STATUSES: Array<{ status: SubOrderStatus; label: string; hint: string }> = [
  { status: 'PAID', label: 'Новые', hint: 'Ждут подтверждения' },
  { status: 'PROCESSING', label: 'В работе', hint: 'Собираются' },
  { status: 'ASSEMBLED', label: 'Готовы', hint: 'К отгрузке' },
  { status: 'SHIPPED', label: 'Отгружены', hint: 'В пути' },
];

export default function DashboardPage() {
  const all = STATUSES.map((s) => ({ status: s, query: useMerchantOrders(s.status) }));

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold">Дашборд</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {all.map(({ status, query }) => (
          <Link key={status.status} href={`/orders?status=${status.status}`}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardContent className="p-6 space-y-2">
                <div className="text-sm text-muted-foreground">{status.hint}</div>
                <div className="text-3xl font-bold">
                  {query.isLoading ? '…' : (query.data?.meta.total ?? 0)}
                </div>
                <div className="font-medium">{status.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
