'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { AuthGate } from '@/components/auth-gate';
import { AreaChart, Donut, RingProgress } from '@/components/charts';
import { Card, CardContent } from '@/components/ui/card';
import { usePlatformAnalytics, type PlatformAnalytics } from '@/lib/api/management';
import { cn, formatPrice } from '@/lib/utils';

export default function DashboardPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function pctChange(
  daily: PlatformAnalytics['daily'],
  sel: (d: PlatformAnalytics['daily'][number]) => number,
) {
  const n = daily.length;
  const w = Math.min(7, Math.floor(n / 2));
  if (w < 1) return null;
  const recent = daily.slice(n - w).reduce((a, d) => a + sel(d), 0);
  const prev = daily.slice(n - 2 * w, n - w).reduce((a, d) => a + sel(d), 0);
  if (prev === 0) return recent > 0 ? 100 : 0;
  return ((recent - prev) / prev) * 100;
}

function Inner() {
  const a = usePlatformAnalytics(30);
  const d = a.data;

  const ordersTrend = d ? pctChange(d.daily, (x) => x.orders) : null;
  const gmvTrend = d ? pctChange(d.daily, (x) => Number(x.gmv)) : null;

  const total = d?.orders.total ?? 0;
  const paid = d?.orders.paid ?? 0;
  const completed = d?.orders.completed ?? 0;
  const cancelled = d?.orders.cancelled ?? 0;
  const other = Math.max(0, total - paid - completed - cancelled);
  const pct = (x: number) => (total > 0 ? (x / total) * 100 : 0);

  const payoutShare =
    d && Number(d.revenue.gmv) > 0 ? (Number(d.revenue.payout) / Number(d.revenue.gmv)) * 100 : 0;

  return (
    <div className="container space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Дашборд</h1>
        <p className="text-sm text-white/60">Активность платформы за последние 30 дней</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Заказы"
          value={total.toLocaleString('ru-RU')}
          icon={ShoppingCart}
          trend={ordersTrend}
          accent="from-sky-400 to-blue-500"
          loading={a.isLoading}
        />
        <StatCard
          label="Оборот (GMV)"
          value={d ? formatPrice(d.revenue.gmv) : '—'}
          icon={DollarSign}
          trend={gmvTrend}
          accent="from-emerald-400 to-teal-500"
          loading={a.isLoading}
        />
        <StatCard
          label="Клиенты"
          value={(d?.totals.customers ?? 0).toLocaleString('ru-RU')}
          icon={Users}
          sub={d ? `+${d.totals.newCustomers} новых` : undefined}
          accent="from-violet-400 to-purple-500"
          loading={a.isLoading}
        />
        <StatCard
          label="Мерчанты"
          value={(d?.totals.merchants ?? 0).toLocaleString('ru-RU')}
          icon={ShieldCheck}
          sub={d ? `${d.totals.products} товаров` : undefined}
          accent="from-amber-400 to-orange-500"
          loading={a.isLoading}
        />
      </div>

      {/* Chart + Donut */}
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Динамика заказов</h2>
              <span className="text-xs text-white/55">за 30 дней</span>
            </div>
            <AreaChart
              data={(d?.daily ?? []).map((x) => ({ label: shortDate(x.date), value: x.orders }))}
            />
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center">
              <Mini label="Всего заказов" value={total.toLocaleString('ru-RU')} />
              <Mini label="Средний чек" value={d ? formatPrice(d.averageCheck) : '—'} />
              <Mini label="Оборот" value={d ? formatPrice(d.revenue.gmv) : '—'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center p-5">
            <h2 className="mb-3 self-start font-semibold text-white">Заказы по статусам</h2>
            <Donut
              centerValue={total.toLocaleString('ru-RU')}
              centerLabel="всего"
              segments={[
                { label: 'Оплачены', value: paid, color: '#34d399' },
                { label: 'Завершены', value: completed, color: '#a78bfa' },
                { label: 'Отменены', value: cancelled, color: '#fb7185' },
                { label: 'В работе', value: other, color: '#38bdf8' },
              ]}
            />
            <div className="mt-4 w-full space-y-2">
              <Legend color="#34d399" label="Оплачены" value={paid} pct={pct(paid)} />
              <Legend color="#a78bfa" label="Завершены" value={completed} pct={pct(completed)} />
              <Legend color="#fb7185" label="Отменены" value={cancelled} pct={pct(cancelled)} />
              <Legend color="#38bdf8" label="В работе" value={other} pct={pct(other)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ring KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <RingCard
          percent={pct(paid)}
          color="#34d399"
          title="Оплачены"
          sub={`${paid} из ${total}`}
        />
        <RingCard
          percent={pct(completed)}
          color="#a78bfa"
          title="Завершены"
          sub={`${completed} из ${total}`}
        />
        <RingCard
          percent={payoutShare}
          color="#fbbf24"
          title="Выплачено мерчантам"
          sub={d ? formatPrice(d.revenue.payout) : '—'}
        />
      </div>

      {/* Top merchants / categories */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 font-semibold text-white">Топ-мерчанты по обороту</h2>
            <TopList
              rows={(d?.topMerchants ?? []).slice(0, 5).map((m) => ({
                key: m.merchantId,
                name: m.brandName,
                meta: `${m.orders} заказов`,
                value: formatPrice(m.gmv),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 font-semibold text-white">Топ-категории по продажам</h2>
            <TopList
              rows={(d?.topCategories ?? []).slice(0, 5).map((c) => ({
                key: c.categoryId,
                name: c.name?.ru ?? '—',
                meta: 'продано',
                value: `${c.quantitySold} шт`,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function shortDate(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getDate()}.${dt.getMonth() + 1}`;
}

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  sub,
  accent,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number | null;
  sub?: string;
  accent: string;
  loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div
              className={cn(
                'text-2xl font-bold text-white',
                loading && 'animate-pulse text-white/50',
              )}
            >
              {value}
            </div>
            <div className="mt-0.5 text-sm text-white/65">{label}</div>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className={cn('mt-3 h-1 rounded-full bg-gradient-to-r', accent)} />
        <div className="mt-2 text-xs">
          {typeof trend === 'number' ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                trend >= 0 ? 'text-emerald-300' : 'text-rose-300',
              )}
            >
              {trend >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(trend).toFixed(1)}%
              <span className="ml-1 font-normal text-white/50">за 7 дней</span>
            </span>
          ) : sub ? (
            <span className="text-white/55">{sub}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-bold text-white">{value}</div>
      <div className="text-[11px] text-white/55">{label}</div>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
  pct,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-white/75">{label}</span>
      <span className="font-medium text-white">{value}</span>
      <span className="w-12 text-right text-xs text-white/50">{pct.toFixed(0)}%</span>
    </div>
  );
}

function RingCard({
  percent,
  color,
  title,
  sub,
}: {
  percent: number;
  color: string;
  title: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <RingProgress percent={percent} color={color} />
        <div>
          <div className="font-semibold text-white">{title}</div>
          <div className="text-sm text-white/60">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopList({
  rows,
}: {
  rows: Array<{ key: string; name: string; meta: string; value: string }>;
}) {
  if (rows.length === 0) return <p className="text-sm text-white/55">Нет данных</p>;
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{r.name}</div>
            <div className="text-[11px] text-white/50">{r.meta}</div>
          </div>
          <div className="text-sm font-semibold text-white">{r.value}</div>
        </div>
      ))}
    </div>
  );
}
