'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useMerchantOrders, type SubOrderStatus } from '@/lib/api/merchant-orders';
import { formatPrice } from '@/lib/utils';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PAID: 'warning',
  PROCESSING: 'default',
  ASSEMBLED: 'default',
  SHIPPED: 'success',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

const ALL_STATUSES: SubOrderStatus[] = ['PAID', 'PROCESSING', 'ASSEMBLED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

export default function MerchantOrdersPage() {
  const params = useSearchParams();
  const status = (params.get('status') ?? '') as SubOrderStatus | '';
  const orders = useMerchantOrders(status || undefined);

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold">Заказы</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/orders"
          className={`px-3 py-1 rounded border ${!status ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
        >
          Все
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/orders?status=${s}`}
            className={`px-3 py-1 rounded border ${status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {orders.isLoading || !orders.data ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : orders.data.data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Заказов нет</div>
      ) : (
        <div className="space-y-3">
          {orders.data.data.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <div className="font-mono text-sm font-medium">{o.subOrderNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString('ru-RU')} · {o.items.length} позиций · {o.fulfillmentType}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Покупатель: {o.order.customerName}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[o.status] ?? 'default'}>{o.status}</Badge>
                  <div className="text-right">
                    <div className="font-bold">{formatPrice(o.subtotal)}</div>
                    <div className="text-xs text-muted-foreground">
                      Комиссия: −{formatPrice(o.commissionAmount)}
                    </div>
                    <div className="text-sm text-green-700 font-medium">
                      К выплате: {formatPrice(o.merchantPayout)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
