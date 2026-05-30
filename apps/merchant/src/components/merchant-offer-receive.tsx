'use client';

import { PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import { useQuickAddCell, useWarehouseCells, useWarehouses } from '@/lib/api/inventory';
import { useReceiveMyOffer } from '@/lib/api/offers';
import { pickLocale } from '@/lib/utils';

/** Приход на своё предложение: склад + ячейка + кол-во → остаток. */
export function MerchantOfferReceive({
  offerId,
  onDone,
}: {
  offerId: string;
  onDone?: () => void;
}) {
  const warehouses = useWarehouses();
  const receive = useReceiveMyOffer();
  const quickCell = useQuickAddCell();
  const [warehouseId, setWarehouseId] = useState('');
  const cells = useWarehouseCells(warehouseId || null);
  const [cellId, setCellId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [newCell, setNewCell] = useState('');

  const whList = warehouses.data ?? [];
  const cellList = (cells.data ?? []).filter((c) => c.isActive && !c.isBlocked);

  async function addCell() {
    if (!newCell.trim() || !warehouseId) return;
    try {
      const c = await quickCell.mutateAsync({ warehouseId, code: newCell.trim() });
      setCellId((c as { id: string }).id);
      setNewCell('');
      toast.success('Ячейка добавлена');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  async function submit() {
    if (!warehouseId || !cellId || !qty) {
      toast.error('Заполните склад, ячейку и количество');
      return;
    }
    try {
      await receive.mutateAsync({
        id: offerId,
        body: {
          warehouseId,
          cellId,
          quantity: Number(qty),
          unitCost: unitCost ? Number(unitCost) : undefined,
        },
      });
      toast.success('Оприходовано. Остаток обновлён.');
      setQty('');
      setUnitCost('');
      onDone?.();
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  if (whList.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        Нет складов. Создайте склад в разделе «Склады», затем приходуйте остаток.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <PackagePlus className="h-4 w-4 text-primary" /> Приход на склад
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setCellId('');
          }}
        >
          <option value="">— склад —</option>
          {whList.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} · {pickLocale(w.name)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={cellId}
          onChange={(e) => setCellId(e.target.value)}
          disabled={!warehouseId}
        >
          <option value="">— ячейка —</option>
          {cellList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
      {warehouseId && cellList.length === 0 ? (
        <div className="flex gap-2">
          <Input
            value={newCell}
            onChange={(e) => setNewCell(e.target.value)}
            placeholder="код ячейки, напр. A-01"
            className="h-9 text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addCell}
            disabled={quickCell.isPending}
          >
            + ячейка
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min={1}
          placeholder="количество"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-9 tabular-nums"
        />
        <Input
          type="number"
          min={0}
          placeholder="себестоимость"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          className="h-9 tabular-nums"
        />
      </div>
      <Button className="w-full" size="sm" onClick={submit} disabled={receive.isPending}>
        {receive.isPending ? 'Приходуем…' : 'Оприходовать'}
      </Button>
    </div>
  );
}
