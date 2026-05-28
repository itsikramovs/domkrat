'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMyOrders } from '@/lib/api/orders';
import { formatPrice } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  CREATED: 'Создан',
  PAID: 'Оплачен',
  PROCESSING: 'Обработка',
  ASSEMBLED: 'Собран',
  SHIPPED: 'Отгружен',
  OUT_FOR_DELIVERY: 'У курьера',
  DELIVERED: 'Доставлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  REFUND_REQUESTED: 'Запрошен возврат',
  REFUNDED: 'Возвращён',
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  CREATED: 'secondary',
  PAID: 'success',
  PROCESSING: 'default',
  ASSEMBLED: 'default',
  SHIPPED: 'default',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

export default function OrdersPage() {
  const orders = useMyOrders();

  if (orders.isLoading || !orders.data) {
    return <div className="text-muted-foreground">Загрузка…</div>;
  }

  if (orders.data.data.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Мои заказы</h1>
        <p className="text-muted-foreground">У вас пока нет заказов.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Мои заказы</h1>
      <div className="space-y-3">
        {orders.data.data.map((o) => (
          <Link key={o.id} href={`/account/orders/${o.id}`}>
            <Card className="hover:border-primary transition-colors">
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium">{o.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.placedAt).toLocaleString('ru-RU')} · {o.items.length} позиций
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[o.status] ?? 'default'}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </Badge>
                <div className="font-bold">{formatPrice(o.totalAmount)}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
