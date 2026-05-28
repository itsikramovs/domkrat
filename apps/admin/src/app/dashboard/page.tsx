'use client';

import { Package, ShoppingBag, Truck, Users, Wallet } from 'lucide-react';
import Link from 'next/link';

import { AuthGate } from '@/components/auth-gate';
import { Card, CardContent } from '@/components/ui/card';
import { useFinanceDashboard } from '@/lib/api/admin';
import { formatPrice } from '@/lib/utils';

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  );
}

function DashboardInner() {
  const dash = useFinanceDashboard();

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold">Финансовый дашборд</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Всего заказов" value={dash.data?.orders.total ?? '—'} icon={ShoppingBag} />
        <Stat title="PAID" value={dash.data?.orders.paid ?? '—'} icon={Package} link="/orders?status=PAID" />
        <Stat title="SHIPPED" value={dash.data?.orders.shipped ?? '—'} icon={Truck} link="/orders?status=SHIPPED" />
        <Stat title="COMPLETED" value={dash.data?.orders.completed ?? '—'} icon={Package} link="/orders?status=COMPLETED" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="GMV (gross)" value={dash.data ? formatPrice(dash.data.revenue.gross) : '—'} icon={Wallet} />
        <Stat title="Мерчанты (активные)" value={dash.data ? `${dash.data.merchants.active}/${dash.data.merchants.total}` : '—'} icon={Users} link="/merchants" />
        <Stat title="Ожидают выплат" value={dash.data?.pendingWithdrawals ?? '—'} icon={Wallet} link="/finance/withdrawals?status=PENDING" highlight={Boolean(dash.data?.pendingWithdrawals)} />
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  icon: Icon,
  link,
  highlight,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  link?: string;
  highlight?: boolean;
}) {
  const card = (
    <Card className={highlight ? 'border-primary' : ''}>
      <CardContent className="p-6 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
  return link ? <Link href={link}>{card}</Link> : card;
}
