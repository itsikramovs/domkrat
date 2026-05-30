'use client';

import { PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiHttpError } from '@/lib/api-client';
import {
  useAdminWarehouses,
  useQuickAddCell,
  useReceiveProduct,
  useWarehouseCells,
} from '@/lib/api/products';

/**
 * Приёмка на конкретное предложение продавца (offerId): склад + ячейка + кол-во → приход.
 * Склады фильтруются по продавцу предложения (его + платформенные).
 */
export function OfferReceivePanel({
  productId,
  offerId,
  merchantId,
  onDone,
}: {
  productId: string;
  offerId: string;
  merchantId: string;
  onDone?: () => void;
}) {
  const warehouses = useAdminWarehouses();
  const receive = useReceiveProduct(productId);
  const [warehouseId, setWarehouseId] = useState('');
  const cells = useWarehouseCells(warehouseId || null);
  const quickCell = useQuickAddCell(warehouseId);
  const [cellId, setCellId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [newCell, setNewCell] = useState('');

  const whList = (warehouses.data ?? []).filter(
    (w) => w.merchantId === merchantId || w.type === 'PLATFORM',
  );
  const cellList = (cells.data ?? []).filter(
    (c) => c.isActive && !c.isBlocked && (!c.merchantId || c.merchantId === merchantId),
  );

  async function addCell() {
    if (!newCell.trim()) return;
    try {
      const c = await quickCell.mutateAsync(newCell.trim());
      setCellId(c.id);
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
        offerId,
        warehouseId,
        cellId,
        quantity: Number(qty),
        unitCost: unitCost ? Number(unitCost) : undefined,
      });
      toast.success('Оприходовано. Предложение в продаже.');
      setQty('');
      setUnitCost('');
      onDone?.();
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-card/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <PackageCheck className="h-4 w-4 text-primary" /> Принять на склад
      </h3>
      <p className="text-xs text-muted-foreground">
        Приёмка + размещение на ячейку. Старые партии продаются раньше (FIFO).
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs">Склад</Label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setCellId('');
          }}
        >
          <option value="">— выбрать —</option>
          {whList.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} · {w.name.ru}
              {w.type === 'PLATFORM' ? ' (платформа)' : ''}
            </option>
          ))}
        </select>
      </div>

      {warehouseId ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Ячейка</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={cellId}
            onChange={(e) => setCellId(e.target.value)}
          >
            <option value="">— выбрать —</option>
            {cellList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
          {cellList.length === 0 ? (
            <div className="flex gap-2">
              <Input
                value={newCell}
                onChange={(e) => setNewCell(e.target.value)}
                placeholder="код, напр. A-01-01-01"
                className="text-xs"
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
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Количество</Label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Себестоимость</Label>
          <Input
            type="number"
            min={0}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            className="tabular-nums"
          />
        </div>
      </div>

      <Button className="w-full" onClick={submit} disabled={receive.isPending}>
        {receive.isPending ? 'Приходуем…' : 'Оприходовать'}
      </Button>
    </div>
  );
}
