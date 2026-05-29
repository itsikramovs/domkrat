'use client';

import { ArrowLeft, PackageCheck, Boxes } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { AdminProductForm } from '@/components/admin-product-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiHttpError } from '@/lib/api-client';
import {
  useAdminProduct,
  useAdminWarehouses,
  useQuickAddCell,
  useReceiveProduct,
  useUpdateAdminProduct,
  useWarehouseCells,
} from '@/lib/api/products';
import { formatPrice } from '@/lib/utils';

const STATUS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }
> = {
  ACTIVE: { label: 'В продаже', variant: 'success' },
  DRAFT: { label: 'Черновик', variant: 'warning' },
  PENDING_REVIEW: { label: 'На модерации', variant: 'warning' },
  INACTIVE: { label: 'Скрыт', variant: 'secondary' },
  REJECTED: { label: 'Отклонён', variant: 'destructive' },
  OUT_OF_STOCK: { label: 'Нет в наличии', variant: 'secondary' },
};

export default function AdminProductDetailPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const id = useParams<{ id: string }>().id;
  const product = useAdminProduct(id);
  const update = useUpdateAdminProduct(id);

  if (product.isLoading || !product.data) {
    return <div className="container py-8 text-white/60">Загрузка…</div>;
  }
  const p = product.data;
  const st = STATUS[p.status] ?? { label: p.status, variant: 'secondary' as const };
  const stock = p.inventoryBalances[0]?.quantityAvailable ?? 0;

  return (
    <div className="container space-y-5 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/catalog/products" aria-label="Назад">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{p.name.ru}</h1>
          <p className="font-mono text-xs text-white/50">
            {p.sku} · {p.merchant.brandName}
          </p>
        </div>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>

      {p.status === 'DRAFT' ? (
        <Card className="border-amber-400/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-200">
            <PackageCheck className="h-5 w-5" />
            Товар-черновик не продаётся. Оприходуйте его на складе (справа) — после размещения он
            станет активным.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <AdminProductForm
          initial={p}
          busy={update.isPending}
          submitLabel="Сохранить изменения"
          onSubmit={async (body) => {
            try {
              await update.mutateAsync(body);
              toast.success('Сохранено');
            } catch (e) {
              const msg = e instanceof ApiHttpError ? e.body.message : 'Ошибка';
              toast.error(Array.isArray(msg) ? msg.join('; ') : String(msg));
            }
          }}
        />

        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <h2 className="flex items-center gap-2 font-semibold text-white">
                <Boxes className="h-4 w-4" /> Остаток
              </h2>
              <div className="text-3xl font-bold text-white">{stock}</div>
              <div className="text-white/55">единиц доступно к продаже</div>
              <div className="border-t border-white/10 pt-2 text-white/60">
                Цена: <span className="font-medium text-white">{formatPrice(p.price)}</span>
              </div>
            </CardContent>
          </Card>

          <ReceivePanel productId={id} merchantId={p.merchant.id} />
        </div>
      </div>
    </div>
  );
}

function ReceivePanel({ productId, merchantId }: { productId: string; merchantId: string }) {
  const warehouses = useAdminWarehouses();
  const receive = useReceiveProduct(productId);
  const [warehouseId, setWarehouseId] = useState('');
  const cells = useWarehouseCells(warehouseId || null);
  const quickCell = useQuickAddCell(warehouseId);
  const [cellId, setCellId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [newCell, setNewCell] = useState('');

  // склады мерчанта + платформенные
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
        warehouseId,
        cellId,
        quantity: Number(qty),
        unitCost: unitCost ? Number(unitCost) : undefined,
      });
      toast.success('Оприходовано. Товар в продаже.');
      setQty('');
      setUnitCost('');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <PackageCheck className="h-4 w-4 text-primary" /> Оприходовать
        </h2>
        <p className="text-xs text-white/55">
          Приёмка + размещение на ячейку. Старые партии продаются раньше (FIFO), неликвид {'>'}3 мес
          — алерт.
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
          {receive.isPending ? 'Приходуем…' : 'Оприходовать и активировать'}
        </Button>
      </CardContent>
    </Card>
  );
}
