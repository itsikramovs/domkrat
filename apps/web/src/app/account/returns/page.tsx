'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMyReturns } from '@/lib/api/returns';
import { formatPrice } from '@/lib/utils';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  REQUESTED: 'warning',
  APPROVED: 'default',
  REJECTED: 'destructive',
  IN_TRANSIT: 'default',
  RECEIVED: 'default',
  INSPECTING: 'default',
  REFUNDED: 'success',
  COMPLETED: 'success',
};

const REASON_LABEL: Record<string, string> = {
  DEFECTIVE: 'Брак',
  WRONG_ITEM: 'Не тот товар',
  NOT_FITTING: 'Не подошло',
  CHANGED_MIND: 'Передумал',
  LATE_DELIVERY: 'Поздняя доставка',
  DAMAGED_IN_TRANSIT: 'Повреждено',
  OTHER: 'Другое',
};

export default function ReturnsPage() {
  const returns = useMyReturns();

  if (returns.isLoading || !returns.data) {
    return <div className="text-muted-foreground">Загрузка…</div>;
  }

  if (returns.data.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Мои возвраты</h1>
        <p className="text-muted-foreground">У вас пока нет возвратов.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Мои возвраты</h1>
      <div className="space-y-3">
        {returns.data.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <div className="font-mono text-sm font-semibold">{r.returnNumber}</div>
                <div className="text-xs text-muted-foreground">
                  Заказ: <Link className="hover:underline" href={`/account/orders/${r.orderId}`}>{r.order.orderNumber}</Link>
                  {' · '}{new Date(r.requestedAt).toLocaleString('ru-RU')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Причина: {REASON_LABEL[r.reason] ?? r.reason} · {r.items.length} позиций
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status}</Badge>
              <div className="font-bold">{formatPrice(r.refundAmount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
