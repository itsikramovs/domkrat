'use client';

import { Boxes, Check, Plus, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import {
  usePickList,
  usePickSubOrder,
  useTransitionOrder,
  type PickListItem,
} from '@/lib/api/merchant-orders';
import { pickLocale } from '@/lib/utils';

type Row = { cellId: string | null; qty: number };

function initRows(item: PickListItem): Row[] {
  const rows: Row[] = item.suggested.map((s) => ({ cellId: s.cellId, qty: s.qty }));
  if (item.shortfall > 0) rows.push({ cellId: null, qty: item.shortfall });
  if (rows.length === 0) rows.push({ cellId: null, qty: item.quantity });
  return rows;
}

/** Лист отбора суб-заказа: ячейки + количества, подтверждение сборки или авто-FIFO. */
export function OrderPickPanel({ subOrderId }: { subOrderId: string }) {
  const pl = usePickList(subOrderId);
  const pick = usePickSubOrder();
  const ready = useTransitionOrder();
  const [alloc, setAlloc] = useState<Record<string, Row[]>>({});

  useEffect(() => {
    if (!pl.data) return;
    setAlloc(Object.fromEntries(pl.data.items.map((it) => [it.orderItemId, initRows(it)])));
  }, [pl.data]);

  if (pl.isLoading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Загрузка отбора…</div>;
  }
  if (!pl.data) return null;

  const items = pl.data.items;
  const setRow = (itemId: string, idx: number, patch: Partial<Row>) =>
    setAlloc((a) => ({
      ...a,
      [itemId]: a[itemId]!.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  const addRow = (itemId: string) =>
    setAlloc((a) => ({ ...a, [itemId]: [...(a[itemId] ?? []), { cellId: null, qty: 1 }] }));
  const delRow = (itemId: string, idx: number) =>
    setAlloc((a) => ({ ...a, [itemId]: a[itemId]!.filter((_, i) => i !== idx) }));

  const totalOf = (itemId: string) => (alloc[itemId] ?? []).reduce((s, r) => s + (r.qty || 0), 0);
  const allMatch = items.every((it) => totalOf(it.orderItemId) === it.quantity);

  async function submitPick() {
    try {
      const payload = items.map((it) => ({
        orderItemId: it.orderItemId,
        picks: (alloc[it.orderItemId] ?? []).filter((r) => r.qty > 0),
      }));
      await pick.mutateAsync({ id: subOrderId, items: payload });
      toast.success('Заказ собран из ячеек');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка сборки');
    }
  }

  async function quickAssemble() {
    try {
      await ready.mutateAsync({ id: subOrderId, action: 'ready' });
      toast.success('Собрано авто-FIFO');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Boxes className="h-4 w-4 text-primary" /> Сборка из ячеек
        </div>
        <Button size="sm" variant="outline" onClick={quickAssemble} disabled={ready.isPending}>
          <Zap className="mr-1 h-4 w-4" /> Быстрая сборка (FIFO)
        </Button>
      </div>

      {items.map((it) => {
        const total = totalOf(it.orderItemId);
        const ok = total === it.quantity;
        return (
          <div key={it.orderItemId} className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{it.name ? pickLocale(it.name) : it.sku}</span>
              <span className={`tabular-nums ${ok ? 'text-emerald-600' : 'text-destructive'}`}>
                отобрано {total} / {it.quantity}
              </span>
            </div>
            <div className="space-y-2">
              {(alloc[it.orderItemId] ?? []).map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={row.cellId ?? ''}
                    onChange={(e) =>
                      setRow(it.orderItemId, idx, { cellId: e.target.value || null })
                    }
                  >
                    <option value="">— без ячейки —</option>
                    {it.cells.map((c) => (
                      <option key={c.cellId} value={c.cellId ?? ''}>
                        {c.code} (дост. {c.available})
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    value={row.qty}
                    onChange={(e) => setRow(it.orderItemId, idx, { qty: Number(e.target.value) })}
                    className="h-9 w-24 tabular-nums"
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => delRow(it.orderItemId, idx)}
                    title="Убрать строку"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => addRow(it.orderItemId)}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" /> ячейка
              </Button>
            </div>
          </div>
        );
      })}

      <Button className="w-full" onClick={submitPick} disabled={!allMatch || pick.isPending}>
        <Check className="mr-2 h-4 w-4" />
        {pick.isPending ? 'Собираем…' : 'Подтвердить сборку (→ ASSEMBLED)'}
      </Button>
      {!allMatch ? (
        <p className="text-center text-xs text-muted-foreground">
          Сумма отобранного по каждой позиции должна совпадать с количеством.
        </p>
      ) : null}
    </div>
  );
}
