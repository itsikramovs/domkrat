'use client';

import { useState } from 'react';

import { AuthGate } from '@/components/auth-gate';
import { Card, CardContent } from '@/components/ui/card';
import { usePlatformAnalytics, type PlatformAnalytics } from '@/lib/api/management';
import { formatPrice } from '@/lib/utils';

const RANGES = [
  { v: 7, label: '7 дней' },
  { v: 30, label: '30 дней' },
  { v: 90, label: '90 дней' },
];

export default function AnalyticsPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [range, setRange] = useState(30);
  const q = usePlatformAnalytics(range);
  const d = q.data;

  const hasRevenue = d ? Number(d.revenue.gmv) > 0 : false;

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Аналитика платформы</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.v}
              onClick={() => setRange(r.v)}
              className={`rounded-md border px-3 py-1 text-sm ${
                range === r.v
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading || !d ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat title="GMV (оборот)" value={formatPrice(d.revenue.gmv)} />
            <Stat title="Комиссия платформы" value={formatPrice(d.revenue.commission)} />
            <Stat title="Выплаты мерчантам" value={formatPrice(d.revenue.payout)} />
            <Stat title="Средний чек" value={formatPrice(d.averageCheck)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              title="Заказов"
              value={String(d.orders.total)}
              sub={`${d.orders.completed} завершено · ${d.orders.cancelled} отменено`}
            />
            <Stat title="Оплачено" value={String(d.orders.paid)} />
            <Stat title="Активных мерчантов" value={String(d.totals.merchants)} />
            <Stat
              title="Клиентов"
              value={String(d.totals.customers)}
              sub={`+${d.totals.newCustomers} за период`}
            />
          </div>

          {!hasRevenue ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              За выбранный период нет оплаченных заказов — графики выручки пустые. Это нормально для
              свежей базы (в seed нет завершённых заказов).
            </div>
          ) : null}

          <DailyChart daily={d.daily} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-sm font-semibold">Топ мерчантов по обороту</div>
                <BarList
                  items={d.topMerchants.map((m) => ({
                    label: m.brandName,
                    value: Number(m.gmv),
                    hint: `${formatPrice(m.gmv)} · ${m.orders} зак.`,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-sm font-semibold">Топ категорий по продажам</div>
                <BarList
                  items={d.topCategories.map((c) => ({
                    label: c.name?.ru ?? '—',
                    value: c.quantitySold,
                    hint: `${c.quantitySold} шт.`,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function DailyChart({ daily }: { daily: PlatformAnalytics['daily'] }) {
  const max = Math.max(1, ...daily.map((p) => Number(p.gmv)));
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 text-sm font-semibold">Оборот по дням</div>
        <div className="flex h-40 items-end gap-0.5">
          {daily.map((p) => {
            const h = (Number(p.gmv) / max) * 100;
            return (
              <div
                key={p.date}
                className="group relative flex-1 rounded-t bg-primary/80 transition-colors hover:bg-primary"
                style={{ height: `${Math.max(h, 1)}%` }}
                title={`${p.date}: ${formatPrice(p.gmv)} (${p.orders} зак.)`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function BarList({ items }: { items: Array<{ label: string; value: number; hint: string }> }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет данных за период</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="space-y-0.5">
          <div className="flex justify-between text-sm">
            <span className="truncate">{it.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{it.hint}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
        {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}
