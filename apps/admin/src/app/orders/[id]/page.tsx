'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { AdminOrderPickPanel } from '@/components/admin-order-pick-panel';
import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminOrder, useUpdateOrderStatus } from '@/lib/api/admin';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Создан',
  PAID: 'Оплачен',
  PROCESSING: 'В обработке',
  ASSEMBLED: 'Собран',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

const SETTABLE = [
  'PAID',
  'PROCESSING',
  'ASSEMBLED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
];

function statusVariant(s: string): 'success' | 'destructive' | 'default' | 'secondary' {
  if (s === 'COMPLETED' || s === 'DELIVERED' || s === 'PAID') return 'success';
  if (s === 'CANCELLED') return 'destructive';
  return 'default';
}

export default function AdminOrderDetailPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const order = useAdminOrder(id);
  const update = useUpdateOrderStatus(id);

  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');

  async function changeStatus() {
    if (!target) return;
    try {
      await update.mutateAsync({ status: target, reason: reason || undefined });
      toast.success('Статус заказа изменён');
      setTarget('');
      setReason('');
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  if (order.isLoading || !order.data) {
    return <div className="container py-8 text-muted-foreground">Загрузка…</div>;
  }
  const o = order.data;
  const customer = `${o.user.firstName ?? ''} ${o.user.lastName ?? ''}`.trim() || o.customerName;

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/orders" aria-label="Назад">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="font-mono text-2xl font-bold">{o.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(o.placedAt).toLocaleString('ru-RU')}
          </p>
        </div>
        <Badge variant={statusVariant(o.status)}>{STATUS_LABELS[o.status] ?? o.status}</Badge>
        <Badge variant={o.paymentStatus === 'PAID' ? 'success' : 'secondary'}>
          {o.paymentStatus}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Позиции */}
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 font-semibold">Позиции ({o.items.length})</h2>
              <div className="divide-y">
                {o.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {it.product?.name.ru ?? it.productSnapshot?.name?.ru ?? '—'}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {it.productSnapshot?.sku ?? ''} · {it.quantity} ×{' '}
                        {formatPrice(it.unitPrice)}
                      </div>
                    </div>
                    <div className="font-semibold tabular-nums">{formatPrice(it.subtotal)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                <Row label="Товары" value={formatPrice(o.subtotal)} />
                {Number(o.discountAmount) > 0 ? (
                  <Row label="Скидка" value={`−${formatPrice(o.discountAmount)}`} />
                ) : null}
                <Row label="Доставка" value={formatPrice(o.deliveryCost)} />
                <Row label="НДС" value={formatPrice(o.vatAmount)} muted />
                <div className="flex items-center justify-between pt-1 text-base font-bold">
                  <span>Итого</span>
                  <span className="tabular-nums">{formatPrice(o.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Суб-заказы по мерчантам */}
          {o.subOrders.length > 0 ? (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 font-semibold">Отправления мерчантов ({o.subOrders.length})</h2>
                <div className="space-y-2">
                  {o.subOrders.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{s.merchant.brandName}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {s.subOrderNumber}
                        </div>
                      </div>
                      <Badge variant={statusVariant(s.status)}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                      <div className="text-right text-xs">
                        <div>оборот: {formatPrice(s.subtotal)}</div>
                        <div className="text-muted-foreground">
                          комиссия: {formatPrice(s.commissionAmount)} · выплата:{' '}
                          {formatPrice(s.merchantPayout)}
                        </div>
                      </div>
                      <div className="w-full">
                        <AdminOrderPickPanel orderId={id} subOrderId={s.id} status={s.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* История статусов */}
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 font-semibold">История статусов</h2>
              {o.statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Изменений пока нет.</p>
              ) : (
                <ol className="space-y-2">
                  {o.statusHistory.map((h) => (
                    <li key={String(h.id)} className="flex items-start gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <div>
                          <span className="text-muted-foreground">
                            {STATUS_LABELS[h.fromStatus] ?? h.fromStatus}
                          </span>{' '}
                          →{' '}
                          <span className="font-medium">
                            {STATUS_LABELS[h.toStatus] ?? h.toStatus}
                          </span>
                          {h.changedByRole ? (
                            <span className="text-xs text-muted-foreground">
                              {' '}
                              · {h.changedByRole}
                            </span>
                          ) : null}
                        </div>
                        {h.reason ? (
                          <div className="text-xs text-muted-foreground">{h.reason}</div>
                        ) : null}
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(h.createdAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Сайдбар: клиент, оплата, управление статусом */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <h2 className="font-semibold">Клиент</h2>
              <Row label="Имя" value={customer} />
              <Row label="Телефон" value={o.customerPhone ?? o.user.phone ?? '—'} />
              <Row label="Email" value={o.customerEmail ?? o.user.email ?? '—'} />
              <Row label="Оплата" value={o.paymentMethod} />
              <Row label="Доставка" value={o.deliveryMethod} />
              {o.customerNotes ? <Row label="Комментарий" value={o.customerNotes} /> : null}
              {o.cancellationReason ? (
                <Row label="Причина отмены" value={o.cancellationReason} />
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-primary/40">
            <CardContent className="space-y-3 p-4">
              <h2 className="font-semibold">Сменить статус</h2>
              <p className="text-xs text-muted-foreground">
                Ручной override. Действие фиксируется в истории. Для отмены укажите причину.
              </p>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— выбрать статус —</option>
                {SETTABLE.filter((s) => s !== o.status).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {target === 'CANCELLED' ? (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Причина отмены"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              ) : null}
              <Button
                className="w-full"
                disabled={!target || update.isPending}
                onClick={changeStatus}
              >
                Применить
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? 'text-muted-foreground' : 'font-medium'}>{value}</span>
    </div>
  );
}
