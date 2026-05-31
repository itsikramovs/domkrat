'use client';

import { Boxes, Check, Plus, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import { useSubOrderPickList, usePickSubOrder, type AdminPickList } from '@/lib/api/admin';

type Row = { cellId: string | null; qty: number };

function initRows(item: AdminPickList['items'][number]): Row[] {
  const rows: Row[] = item.suggested.map((s) => ({ cellId: s.cellId, qty: s.qty }));
  if (item.shortfall > 0) rows.push({ cellId: null, qty: item.shortfall });
  if (rows.length === 0) rows.push({ cellId: null, qty: item.quantity });
  return rows;
}

/** Сборка/отгрузка FBO-суб-заказа из платформенных ячеек (для админа/склада). */
export function AdminOrderPickPanel({
  orderId,
  subOrderId,
  status,
}: {
  orderId: string;
  subOrderId: string;
  status: string;
}) {
  const enabled = status === 'PROCESSING';
  const pl = useSubOrderPickList(subOrderId, enabled);
  const { pick, ship } = usePickSubOrder(orderId);
  const [alloc, setAlloc] = useState<Record<string, Row[]>>({});

  useEffect(() => {
    if (!pl.data) return;
    setAlloc(Object.fromEntries(pl.data.items.map((it) => [it.orderItemId, initRows(it)])));
  }, [pl.data]);

  if (status === 'ASSEMBLED') {
    return (
      <Button
        size="sm"
        className="mt-2"
        disabled={ship.isPending}
        onClick={async () => {
          try {
            await ship.mutateAsync(subOrderId);
            toast.success('Отгружено');
          } catch (e) {
            toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
          }
        }}
      >
        <Truck className="mr-1 h-4 w-4" /> Отгрузить
      </Button>
    );
  }

  if (!enabled) return null;
  if (pl.isLoading || !pl.data) {
    return <div className="mt-2 text-xs text-muted-foreground">Загрузка отбора…</div>;
  }

  const items = pl.data.items;
  const setRow = (id: string, idx: number, patch: Partial<Row>) =>
    setAlloc((a) => ({ ...a, [id]: a[id]!.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  const totalOf = (id: string) => (alloc[id] ?? []).reduce((s, r) => s + (r.qty || 0), 0);
  const allMatch = items.every((it) => totalOf(it.orderItemId) === it.quantity);

  async function submit() {
    try {
      await pick.mutateAsync({
        subOrderId,
        items: items.map((it) => ({
          orderItemId: it.orderItemId,
          picks: (alloc[it.orderItemId] ?? []).filter((r) => r.qty > 0),
        })),
      });
      toast.success('Собрано из ячеек');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка сборки');
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Boxes className="h-4 w-4 text-primary" /> Сборка из ячеек (FBO)
      </div>
      {items.map((it) => {
        const ok = totalOf(it.orderItemId) === it.quantity;
        return (
          <div key={it.orderItemId} className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{it.name?.ru ?? it.sku}</span>
              <span className={`tabular-nums ${ok ? 'text-emerald-600' : 'text-destructive'}`}>
                {totalOf(it.orderItemId)} / {it.quantity}
              </span>
            </div>
            {(alloc[it.orderItemId] ?? []).map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                  value={row.cellId ?? ''}
                  onChange={(e) => setRow(it.orderItemId, idx, { cellId: e.target.value || null })}
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
                  className="h-8 w-20 tabular-nums"
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setAlloc((a) => ({
                      ...a,
                      [it.orderItemId]: a[it.orderItemId]!.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                setAlloc((a) => ({
                  ...a,
                  [it.orderItemId]: [...(a[it.orderItemId] ?? []), { cellId: null, qty: 1 }],
                }))
              }
            >
              <Plus className="h-3 w-3" /> ячейка
            </button>
          </div>
        );
      })}
      <Button size="sm" className="w-full" disabled={!allMatch || pick.isPending} onClick={submit}>
        <Check className="mr-1 h-4 w-4" /> Собрать (→ ASSEMBLED)
      </Button>
    </div>
  );
}
