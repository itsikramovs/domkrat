'use client';

import { ArrowLeft, Check, Truck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { OrderPickPanel } from '@/components/order-pick-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMerchantOrder, useTransitionOrder } from '@/lib/api/merchant-orders';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice, pickLocale } from '@/lib/utils';

export default function MerchantOrderPage() {
  const params = useParams<{ id: string }>();
  const order = useMerchantOrder(params.id ?? null);
  const transition = useTransitionOrder();

  if (order.isLoading || !order.data) {
    return <div className="container py-12 text-center text-muted-foreground">Загрузка…</div>;
  }

  const o = order.data;

  async function act(action: 'confirm' | 'ready' | 'ship') {
    try {
      await transition.mutateAsync({ id: o.id, action });
      const map = { confirm: 'Подтверждено', ready: 'Готов к отгрузке', ship: 'Отгружено' };
      toast.success(map[action]);
    } catch (error) {
      const msg = error instanceof ApiHttpError ? error.body.message : 'Ошибка';
      toast.error(msg);
    }
  }

  const canConfirm = o.status === 'PAID';
  const canReady = o.status === 'PROCESSING';
  const canShip = o.status === 'ASSEMBLED';

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-mono">{o.subOrderNumber}</h1>
        <Badge variant={o.status === 'SHIPPED' ? 'success' : 'default'}>{o.status}</Badge>
        <Badge variant="outline">{o.fulfillmentType}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => act('confirm')} disabled={!canConfirm || transition.isPending}>
              <Check className="mr-2 h-4 w-4" /> Подтвердить (→ PROCESSING)
            </Button>
            <Button
              onClick={() => act('ship')}
              disabled={!canShip || transition.isPending}
              variant="default"
            >
              <Truck className="mr-2 h-4 w-4" /> Отгрузить (→ SHIPPED)
            </Button>
          </div>
          {canReady ? (
            <div className="border-t pt-4">
              <OrderPickPanel subOrderId={o.id} label={o.subOrderNumber} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6 space-y-2 text-sm">
            <h2 className="font-semibold mb-2">Заказ покупателя</h2>
            <Row label="Номер" value={o.order.orderNumber} mono />
            <Row label="Имя" value={o.order.customerName} />
            <Row label="Телефон" value={o.order.customerPhone ?? '—'} />
            <Row label="Email" value={o.order.customerEmail ?? '—'} />
            <Row label="Доставка" value={o.order.deliveryMethod} />
            <Row label="Оплата" value={o.order.paymentMethod} />
            <Row label="Размещён" value={new Date(o.order.placedAt).toLocaleString('ru-RU')} />
            {o.order.paidAt ? (
              <Row label="Оплачен" value={new Date(o.order.paidAt).toLocaleString('ru-RU')} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-2 text-sm">
            <h2 className="font-semibold mb-2">Финансы</h2>
            <Row label="Сумма заказа" value={formatPrice(o.subtotal)} />
            <Row label="Комиссия платформы" value={`−${formatPrice(o.commissionAmount)}`} muted />
            <Row label="К выплате" value={formatPrice(o.merchantPayout)} large />
            {o.order.deliveryAddressSnapshot ? (
              <>
                <div className="pt-2 font-semibold">Адрес</div>
                <div className="text-muted-foreground">
                  {o.order.deliveryAddressSnapshot.recipientName},{' '}
                  {o.order.deliveryAddressSnapshot.recipientPhone}
                </div>
                <div className="text-muted-foreground">
                  {o.order.deliveryAddressSnapshot.city},{' '}
                  {o.order.deliveryAddressSnapshot.addressLine}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-2">
          <h2 className="font-semibold">Позиции ({o.items.length})</h2>
          {o.items.map((i) => (
            <div
              key={i.id}
              className="flex justify-between items-start py-2 border-b last:border-0 text-sm"
            >
              <div className="flex-1">
                <div className="font-medium">{pickLocale(i.productSnapshot.name)}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {i.productSnapshot.sku}
                  {i.productSnapshot.oemNumber ? ` · OEM ${i.productSnapshot.oemNumber}` : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  qty: {i.quantity} × {formatPrice(i.unitPrice)}
                </div>
              </div>
              <div className="font-bold">{formatPrice(i.subtotal)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  large,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  large?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`flex justify-between ${large ? 'text-base font-bold' : ''}`}>
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={`${muted ? 'text-muted-foreground' : ''} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
