'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  usePlaceReceipt,
  useQualityCheck,
  useReceipt,
  useReceiveReceipt,
  useSubmitReceipt,
  useWarehouseCells,
  type ReceiptItem,
} from '@/lib/api/inventory';
import { ApiHttpError } from '@/lib/api-client';
import { pickLocale } from '@/lib/utils';

import { ReceiptStatusBadge } from '../page';

function placedTotal(item: ReceiptItem): number {
  if (!item.placedInCells) return 0;
  return Object.values(item.placedInCells).reduce((s, n) => s + n, 0);
}

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const receipt = useReceipt(id);
  const submit = useSubmitReceipt();
  const receive = useReceiveReceipt();
  const qc = useQualityCheck();
  const place = usePlaceReceipt();
  const r = receipt.data;
  const cells = useWarehouseCells(r?.status === 'PLACING' ? (r?.warehouse?.id ?? null) : null);

  // локальные формы
  const [recv, setRecv] = useState<Record<string, number>>({});
  const [acc, setAcc] = useState<Record<string, number>>({});
  const [rej, setRej] = useState<Record<string, number>>({});
  const [plc, setPlc] = useState<Record<string, { cellId: string; qty: number }>>({});

  useEffect(() => {
    if (!r?.items) return;
    setRecv(Object.fromEntries(r.items.map((i) => [i.id, i.expectedQuantity])));
    setAcc(Object.fromEntries(r.items.map((i) => [i.id, i.receivedQuantity])));
    setRej(Object.fromEntries(r.items.map((i) => [i.id, 0])));
    setPlc(
      Object.fromEntries(
        r.items.map((i) => [
          i.id,
          { cellId: '', qty: Math.max(0, i.acceptedQuantity - placedTotal(i)) },
        ]),
      ),
    );
  }, [r?.id, r?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (receipt.isLoading)
    return <div className="container py-12 text-muted-foreground">Загрузка…</div>;
  if (!r) return <div className="container py-12 text-muted-foreground">Приёмка не найдена</div>;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  };

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{r.receiptNumber}</h1>
        <ReceiptStatusBadge status={r.status} />
        {r.qualityCheckStatus !== 'PENDING' ? (
          <span className="text-xs text-muted-foreground">QC: {r.qualityCheckStatus}</span>
        ) : null}
      </div>
      <div className="text-sm text-muted-foreground">
        Склад: {r.warehouse ? pickLocale(r.warehouse.name) : '—'} · позиций: {r.items?.length ?? 0}{' '}
        · ожидалось: {r.totalQuantity} шт
      </div>

      {/* Позиции */}
      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2">Товар</th>
                <th className="text-right">Ожид.</th>
                <th className="text-right">Принято</th>
                <th className="text-right">Годно</th>
                <th className="text-right">Брак</th>
                <th className="text-right">Размещено</th>
              </tr>
            </thead>
            <tbody>
              {r.items?.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    {i.product ? pickLocale(i.product.name) : i.productId}
                    <span className="block text-xs text-muted-foreground">{i.product?.sku}</span>
                  </td>
                  <td className="text-right tabular-nums">{i.expectedQuantity}</td>
                  <td className="text-right tabular-nums">{i.receivedQuantity}</td>
                  <td className="text-right tabular-nums">{i.acceptedQuantity}</td>
                  <td className="text-right tabular-nums text-sale">{i.rejectedQuantity || ''}</td>
                  <td className="text-right tabular-nums">{placedTotal(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Действия по статусу */}
      {r.status === 'DRAFT' ? (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Отправьте приёмку в ожидание прихода.
            </span>
            <Button
              disabled={submit.isPending}
              onClick={() => act(() => submit.mutateAsync({ id }), 'Отправлено в ожидание')}
            >
              Отправить → Ожидается
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(r.status === 'EXPECTED' || r.status === 'IN_TRANSIT') && r.items ? (
        <FormCard
          title="Приёмка по факту"
          onSubmit={() =>
            act(
              () =>
                receive.mutateAsync({
                  id,
                  body: {
                    items: r.items!.map((i) => ({
                      itemId: i.id,
                      receivedQuantity: recv[i.id] ?? 0,
                    })),
                  },
                }),
              'Принято по факту',
            )
          }
          pending={receive.isPending}
          cta="Принять"
        >
          {r.items.map((i) => (
            <QtyRow
              key={i.id}
              label={i.product ? pickLocale(i.product.name) : i.productId}
              hint={`ожид. ${i.expectedQuantity}`}
            >
              <Input
                type="number"
                min={0}
                className="w-28"
                value={recv[i.id] ?? 0}
                onChange={(e) => setRecv((s) => ({ ...s, [i.id]: Number(e.target.value) }))}
              />
            </QtyRow>
          ))}
        </FormCard>
      ) : null}

      {(r.status === 'ARRIVED' || r.status === 'CHECKING') && r.items ? (
        <FormCard
          title="Контроль качества"
          onSubmit={() =>
            act(
              () =>
                qc.mutateAsync({
                  id,
                  body: {
                    items: r.items!.map((i) => ({
                      itemId: i.id,
                      acceptedQuantity: acc[i.id] ?? 0,
                      rejectedQuantity: rej[i.id] ?? 0,
                    })),
                  },
                }),
              'Контроль качества завершён',
            )
          }
          pending={qc.isPending}
          cta="Подтвердить → Размещение"
        >
          {r.items.map((i) => (
            <QtyRow
              key={i.id}
              label={i.product ? pickLocale(i.product.name) : i.productId}
              hint={`принято ${i.receivedQuantity}`}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">годно</span>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={acc[i.id] ?? 0}
                  onChange={(e) => setAcc((s) => ({ ...s, [i.id]: Number(e.target.value) }))}
                />
                <span className="text-xs text-muted-foreground">брак</span>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={rej[i.id] ?? 0}
                  onChange={(e) => setRej((s) => ({ ...s, [i.id]: Number(e.target.value) }))}
                />
              </div>
            </QtyRow>
          ))}
        </FormCard>
      ) : null}

      {r.status === 'PLACING' && r.items ? (
        <FormCard
          title="Размещение по ячейкам"
          onSubmit={() => {
            const placements = r
              .items!.map((i) => ({
                itemId: i.id,
                cellId: plc[i.id]?.cellId ?? '',
                quantity: plc[i.id]?.qty ?? 0,
              }))
              .filter(
                (p): p is { itemId: string; cellId: string; quantity: number } =>
                  p.cellId !== '' && p.quantity > 0,
              );
            if (!placements.length) {
              toast.error('Укажите ячейку и количество');
              return Promise.resolve();
            }
            return act(() => place.mutateAsync({ id, body: { placements } }), 'Размещено');
          }}
          pending={place.isPending}
          cta="Разместить"
        >
          {!cells.data?.length ? (
            <p className="text-sm text-muted-foreground">
              На складе нет ячеек — добавьте их на странице «Склады».
            </p>
          ) : (
            r.items.map((i) => {
              const remaining = i.acceptedQuantity - placedTotal(i);
              return (
                <QtyRow
                  key={i.id}
                  label={i.product ? pickLocale(i.product.name) : i.productId}
                  hint={`к размещению ${remaining}`}
                >
                  <div className="flex items-center gap-1">
                    <select
                      className="h-10 w-32 rounded-md border border-input bg-background px-2 text-sm"
                      value={plc[i.id]?.cellId ?? ''}
                      onChange={(e) =>
                        setPlc((s) => ({ ...s, [i.id]: { ...s[i.id]!, cellId: e.target.value } }))
                      }
                      disabled={remaining <= 0}
                    >
                      <option value="">— ячейка —</option>
                      {cells.data!.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      className="w-20"
                      value={plc[i.id]?.qty ?? 0}
                      onChange={(e) =>
                        setPlc((s) => ({
                          ...s,
                          [i.id]: { ...s[i.id]!, qty: Number(e.target.value) },
                        }))
                      }
                      disabled={remaining <= 0}
                    />
                  </div>
                </QtyRow>
              );
            })
          )}
        </FormCard>
      ) : null}

      {r.status === 'COMPLETED' ? (
        <Card>
          <CardContent className="p-4 text-sm text-hit">
            ✓ Приёмка завершена — товар оприходован и доступен к продаже.
          </CardContent>
        </Card>
      ) : null}
      {r.status === 'REJECTED' ? (
        <Card>
          <CardContent className="p-4 text-sm text-sale">
            Приёмка отклонена (контроль качества не пройден).
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function FormCard({
  title,
  children,
  onSubmit,
  pending,
  cta,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  pending: boolean;
  cta: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="space-y-2">{children}</div>
        <Button disabled={pending} onClick={onSubmit}>
          {pending ? 'Сохранение…' : cta}
        </Button>
      </CardContent>
    </Card>
  );
}

function QtyRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
      <div className="min-w-[140px]">
        <Label className="text-sm">{label}</Label>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}
