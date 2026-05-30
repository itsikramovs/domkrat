'use client';

import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiHttpError } from '@/lib/api-client';
import { useAdminMerchants } from '@/lib/api/admin';
import {
  useAdminProductList,
  useAdminWarehouses,
  useReceiveBatch,
  useWarehouseCells,
} from '@/lib/api/products';

type Row = { offerId: string; cellId: string; quantity: string; unitCost: string };
const emptyRow = (): Row => ({ offerId: '', cellId: '', quantity: '', unitCost: '' });
const selectCls =
  'h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground';

export default function BatchReceivePage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const merchants = useAdminMerchants({ status: 'ACTIVE' });
  const warehouses = useAdminWarehouses();
  const receive = useReceiveBatch();

  const [merchantId, setMerchantId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const products = useAdminProductList({ merchantId });
  const cells = useWarehouseCells(warehouseId || null);

  const whList = (warehouses.data ?? []).filter(
    (w) => w.merchantId === merchantId || w.type === 'PLATFORM',
  );
  const cellList = (cells.data ?? []).filter(
    (c) => c.isActive && !c.isBlocked && (!c.merchantId || c.merchantId === merchantId),
  );
  const productList = products.data?.data ?? [];

  function setRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function submit() {
    const items = rows
      .filter((r) => r.offerId && r.cellId && Number(r.quantity) > 0)
      .map((r) => ({
        offerId: r.offerId,
        cellId: r.cellId,
        quantity: Number(r.quantity),
        unitCost: r.unitCost ? Number(r.unitCost) : undefined,
      }));
    if (!merchantId || !warehouseId || items.length === 0) {
      toast.error('Выберите мерчанта, склад и заполните хотя бы одну строку');
      return;
    }
    try {
      const res = (await receive.mutateAsync({ warehouseId, items })) as {
        activated: number;
      };
      toast.success(`Принято и активировано товаров: ${res.activated}`);
      setRows([emptyRow()]);
    } catch (e) {
      const msg = e instanceof ApiHttpError ? e.body.message : 'Ошибка';
      toast.error(Array.isArray(msg) ? msg.join('; ') : String(msg));
    }
  }

  return (
    <div className="container max-w-4xl space-y-5 py-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/warehouses" aria-label="Назад">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Приёмка партии</h1>
          <p className="text-sm text-white/55">
            Оприходование нескольких товаров на склад. После размещения они становятся продаваемыми.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Мерчант</Label>
            <select
              className={selectCls}
              value={merchantId}
              onChange={(e) => {
                setMerchantId(e.target.value);
                setRows([emptyRow()]);
              }}
            >
              <option value="">— выбрать —</option>
              {(merchants.data?.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brandName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Склад</Label>
            <select
              className={selectCls}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={!merchantId}
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
        </CardContent>
      </Card>

      {merchantId && warehouseId ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Позиции</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRows((r) => [...r, emptyRow()])}
              >
                <Plus className="h-4 w-4" /> Строка
              </Button>
            </div>

            {rows.map((row, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_140px_90px_110px_auto]">
                <select
                  className={selectCls}
                  value={row.offerId}
                  onChange={(e) => setRow(i, { offerId: e.target.value })}
                >
                  <option value="">— товар —</option>
                  {productList.map((p) => {
                    const off = p.offers.find((o) => o.merchantId === merchantId);
                    if (!off) return null;
                    return (
                      <option key={p.id} value={off.id}>
                        {p.name.ru} ({off.sku})
                      </option>
                    );
                  })}
                </select>
                <select
                  className={selectCls}
                  value={row.cellId}
                  onChange={(e) => setRow(i, { cellId: e.target.value })}
                >
                  <option value="">— ячейка —</option>
                  {cellList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  placeholder="кол-во"
                  value={row.quantity}
                  onChange={(e) => setRow(i, { quantity: e.target.value })}
                  className="tabular-nums"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="себест."
                  value={row.unitCost}
                  onChange={(e) => setRow(i, { unitCost: e.target.value })}
                  className="tabular-nums"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRows((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : r))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            {cellList.length === 0 ? (
              <p className="text-xs text-amber-300">
                На складе нет доступных ячеек — добавьте их в разделе «Склады».
              </p>
            ) : null}

            <Button className="w-full" onClick={submit} disabled={receive.isPending}>
              {receive.isPending ? 'Приходуем…' : 'Оприходовать партию и активировать'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-white/55">Выберите мерчанта и склад, чтобы добавить позиции.</p>
      )}
    </div>
  );
}
