'use client';

import { ArrowLeft, CheckCircle2, MessageSquare, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { ReturnDialog } from '@/components/return-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOrder } from '@/lib/api/orders';
import { apiFetch, ApiHttpError } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { formatPrice, pickLocale } from '@/lib/utils';

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const order = useOrder(params.id ?? null);
  const qc = useQueryClient();
  const [showReturn, setShowReturn] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (order.isLoading || !order.data) return <div className="text-muted-foreground">Загрузка…</div>;
  const o = order.data;

  async function confirmReceipt() {
    if (!o) return;
    setConfirming(true);
    try {
      await apiFetch(`/orders/${o.id}/confirm-receipt`, { method: 'POST' });
      toast.success('Спасибо! Заказ закрыт.');
      void qc.invalidateQueries({ queryKey: ['order', o.id] });
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    } finally {
      setConfirming(false);
    }
  }

  const canConfirm = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status);
  const canReturn = ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(o.status);
  const canReview = o.status === 'COMPLETED';

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

      {canConfirm || canReturn ? (
        <Card>
          <CardContent className="p-6 flex flex-wrap items-center gap-3">
            {canConfirm ? (
              <Button onClick={confirmReceipt} disabled={confirming}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {confirming ? 'Подтверждаем…' : 'Подтвердить получение'}
              </Button>
            ) : null}
            {canReturn ? (
              <Button variant="outline" onClick={() => setShowReturn(true)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Вернуть товар
              </Button>
            ) : null}
            {canReview ? (
              <Button asChild variant="ghost">
                <Link href={`/p/${o.items[0]?.productSnapshot?.slug ?? ''}#reviews`}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Оставить отзыв
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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

      {showReturn ? (
        <ReturnDialog
          orderId={o.id}
          items={o.items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            productSnapshot: i.productSnapshot,
          }))}
          onClose={() => setShowReturn(false)}
        />
      ) : null}
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
