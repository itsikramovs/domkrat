'use client';

import { ArrowRight, Package, ShoppingBag, Truck, Users, Wallet } from 'lucide-react';
import Link from 'next/link';

import { AuthGate } from '@/components/auth-gate';
import { Card, CardContent } from '@/components/ui/card';
import { useFinanceDashboard } from '@/lib/api/admin';
import { cn, formatPrice } from '@/lib/utils';

type Accent = 'primary' | 'emerald' | 'blue' | 'violet' | 'amber';

const ACCENT: Record<Accent, string> = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  blue: 'bg-blue-500/10 text-blue-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber: 'bg-amber-500/10 text-amber-600',
};

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  );
}

function DashboardInner() {
  const dash = useFinanceDashboard();
  const d = dash.data;

  return (
    <div className="container space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground">
          Сводка по заказам, выручке и партнёрам платформы
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Заказы
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            title="Всего заказов"
            value={d?.orders.total ?? '—'}
            icon={ShoppingBag}
            accent="primary"
            loading={dash.isLoading}
          />
          <Stat
            title="Оплачены"
            value={d?.orders.paid ?? '—'}
            icon={Package}
            accent="emerald"
            link="/orders?status=PAID"
            loading={dash.isLoading}
          />
          <Stat
            title="Отправлены"
            value={d?.orders.shipped ?? '—'}
            icon={Truck}
            accent="blue"
            link="/orders?status=SHIPPED"
            loading={dash.isLoading}
          />
          <Stat
            title="Завершены"
            value={d?.orders.completed ?? '—'}
            icon={Package}
            accent="violet"
            link="/orders?status=COMPLETED"
            loading={dash.isLoading}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Финансы и партнёры
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            title="GMV (оборот)"
            value={d ? formatPrice(d.revenue.gross) : '—'}
            icon={Wallet}
            accent="emerald"
            loading={dash.isLoading}
          />
          <Stat
            title="Активные мерчанты"
            value={d ? `${d.merchants.active} / ${d.merchants.total}` : '—'}
            icon={Users}
            accent="primary"
            link="/merchants"
            loading={dash.isLoading}
          />
          <Stat
            title="Ожидают выплат"
            value={d?.pendingWithdrawals ?? '—'}
            icon={Wallet}
            accent="amber"
            link="/finance/withdrawals?status=PENDING"
            highlight={Boolean(d?.pendingWithdrawals)}
            loading={dash.isLoading}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  title,
  value,
  icon: Icon,
  accent,
  link,
  highlight,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent: Accent;
  link?: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  const card = (
    <Card
      className={cn(
        'h-full transition-all',
        link && 'hover:-translate-y-0.5 hover:shadow-card-hover',
        highlight && 'ring-1 ring-amber-400/60',
      )}
    >
      <CardContent className="flex items-start gap-4 p-5">
        <span
          className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', ACCENT[accent])}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            {title}
            {link ? (
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            ) : null}
          </div>
          <div
            className={cn(
              'mt-1 text-2xl font-bold tabular-nums',
              loading && 'animate-pulse text-muted-foreground',
            )}
          >
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return link ? (
    <Link href={link} className="group block">
      {card}
    </Link>
  ) : (
    card
  );
}
