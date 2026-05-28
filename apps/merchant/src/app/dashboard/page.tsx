'use client';

import Link from 'next/link';
import { useState } from 'react';

import { AnalyticsCard } from '@/components/analytics-card';
import { Card, CardContent } from '@/components/ui/card';
import { useMerchantOrders, type SubOrderStatus } from '@/lib/api/merchant-orders';

const STATUSES: Array<{ status: SubOrderStatus; label: string; hint: string }> = [
  { status: 'PAID', label: 'Новые', hint: 'Ждут подтверждения' },
  { status: 'PROCESSING', label: 'В работе', hint: 'Собираются' },
  { status: 'ASSEMBLED', label: 'Готовы', hint: 'К отгрузке' },
  { status: 'SHIPPED', label: 'Отгружены', hint: 'В пути' },
];

const RANGES = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
];

export default function DashboardPage() {
  const [range, setRange] = useState(30);
  const all = STATUSES.map((s) => ({ status: s, query: useMerchantOrders(s.status) }));

  return (
    <div className="container py-8 space-y-8">
      <h1 className="text-3xl font-bold">Дашборд</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Заказы в работе</h2>
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
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Аналитика</h2>
          <div className="inline-flex rounded-md border bg-background text-xs">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  range === r.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <AnalyticsCard range={range} />
      </section>
    </div>
  );
}
