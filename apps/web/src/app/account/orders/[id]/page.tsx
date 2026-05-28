'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOrder } from '@/lib/api/orders';
import { formatPrice, pickLocale } from '@/lib/utils';

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const order = useOrder(params.id ?? null);

  if (order.isLoading || !order.data) return <div className="text-muted-foreground">Загрузка…</div>;
  const o = order.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/account/orders"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">{o.orderNumber}</h1>
        <Badge variant={o.status === 'PAID' || o.status === 'COMPLETED' ? 'success' : 'default'}>
          {o.status}
        </Badge>
        <Badge variant={o.paymentStatus === 'PAID' ? 'success' : 'secondary'}>
          Оплата: {o.paymentStatus}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-semibold">Позиции ({o.items.length})</h2>
          <div className="space-y-2">
            {o.items.map((i) => (
              <div key={i.id} className="flex justify-between items-start text-sm py-2 border-b last:border-0">
                <div className="flex-1">
                  <div className="font-medium">{pickLocale(i.productSnapshot.name)}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {i.productSnapshot.sku} · qty: {i.quantity} × {formatPrice(i.unitPrice)}
                  </div>
                </div>
                <div className="font-bold">{formatPrice(i.subtotal)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6 space-y-2 text-sm">
            <h2 className="font-semibold mb-2">Подзаказы по мерчантам</h2>
            {o.subOrders.map((so) => (
              <div key={so.id} className="flex justify-between py-1">
                <span className="font-mono text-xs">{so.subOrderNumber}</span>
                <Badge variant="outline">{so.fulfillmentType}</Badge>
                <span>{formatPrice(so.subtotal)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-1 text-sm">
            <h2 className="font-semibold mb-2">Итого</h2>
            <Row label="Товары" value={formatPrice(o.subtotal)} />
            <Row label="Доставка" value={formatPrice(o.deliveryCost)} />
            <Row label="НДС (включён)" value={formatPrice(o.vatAmount)} muted />
            <Row label="К оплате" value={formatPrice(o.totalAmount)} large />
            <Row label="Оплачено" value={formatPrice(o.paidAmount)} />
            {o.paidAt ? <div className="text-xs text-muted-foreground">Оплачен: {new Date(o.paidAt).toLocaleString('ru-RU')}</div> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 text-sm space-y-1">
          <h2 className="font-semibold">Способ доставки</h2>
          <div className="text-muted-foreground">{o.deliveryMethod}</div>
          <h2 className="font-semibold mt-3">Оплата</h2>
          <div className="text-muted-foreground">{o.paymentMethod}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, muted, large }: { label: string; value: string; muted?: boolean; large?: boolean }) {
  return (
    <div className={`flex justify-between ${large ? 'text-base font-bold' : ''}`}>
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={muted ? 'text-muted-foreground' : ''}>{value}</span>
    </div>
  );
}
