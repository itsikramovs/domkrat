'use client';

import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMyProducts } from '@/lib/api/products';
import {
  useCreateReceipt,
  useReceipts,
  useWarehouses,
  type ReceiptStatus,
} from '@/lib/api/inventory';
import { ApiHttpError } from '@/lib/api-client';
import { pickLocale } from '@/lib/utils';

const STATUS: Record<
  ReceiptStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  }
> = {
  DRAFT: { label: 'Черновик', variant: 'outline' },
  SUBMITTED: { label: 'Отправлена', variant: 'secondary' },
  EXPECTED: { label: 'Ожидается', variant: 'warning' },
  IN_TRANSIT: { label: 'В пути', variant: 'warning' },
  ARRIVED: { label: 'Принята', variant: 'secondary' },
  CHECKING: { label: 'Контроль', variant: 'secondary' },
  PLACING: { label: 'Размещение', variant: 'warning' },
  COMPLETED: { label: 'Завершена', variant: 'success' },
  REJECTED: { label: 'Отклонена', variant: 'destructive' },
};

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const s = STATUS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

type Row = { productId: string; expectedQuantity: number; unitCost: string };

export default function ReceiptsPage() {
  const receipts = useReceipts();
  const warehouses = useWarehouses();
  const products = useMyProducts({ perPage: 100 });
  const createReceipt = useCreateReceipt();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [rows, setRows] = useState<Row[]>([{ productId: '', expectedQuantity: 1, unitCost: '' }]);

  const productList = products.data?.data ?? [];

  function setRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = rows
      .filter((r) => r.productId && r.expectedQuantity > 0)
      .map((r) => ({
        productId: r.productId,
        expectedQuantity: Number(r.expectedQuantity),
        unitCost: r.unitCost || undefined,
      }));
    if (!warehouseId || items.length === 0) {
      toast.error('Выберите склад и хотя бы один товар');
      return;
    }
    try {
      const created = (await createReceipt.mutateAsync({ warehouseId, items })) as { id: string };
      toast.success('Приёмка создана');
      router.push(`/receipts/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Приёмки</h1>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? 'Закрыть' : '+ Новая приёмка'}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardContent className="p-4">
            {!warehouses.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Сначала создайте{' '}
                <Link href="/warehouses" className="text-primary underline">
                  склад
                </Link>
                .
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1 max-w-sm">
                  <Label className="text-xs">Склад приёмки *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                  >
                    <option value="">— выберите —</option>
                    {warehouses.data.map((w) => (
                      <option key={w.id} value={w.id}>
                        {pickLocale(w.name)} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Товары</Label>
                  {rows.map((row, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <select
                        className="h-10 flex-1 min-w-[180px] rounded-md border border-input bg-background px-2 text-sm"
                        value={row.productId}
                        onChange={(e) => setRow(i, { productId: e.target.value })}
                      >
                        <option value="">— товар —</option>
                        {productList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {pickLocale(p.name)} ({p.sku})
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={1}
                        className="w-24"
                        value={row.expectedQuantity}
                        onChange={(e) => setRow(i, { expectedQuantity: Number(e.target.value) })}
                        placeholder="кол-во"
                      />
                      <Input
                        className="w-32"
                        value={row.unitCost}
                        onChange={(e) => setRow(i, { unitCost: e.target.value })}
                        placeholder="закуп. цена"
                      />
                      {rows.length > 1 ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRows((r) => [...r, { productId: '', expectedQuantity: 1, unitCost: '' }])
                    }
                  >
                    <Plus className="h-4 w-4" /> Ещё товар
                  </Button>
                </div>

                <Button type="submit" disabled={createReceipt.isPending}>
                  {createReceipt.isPending ? 'Создание…' : 'Создать приёмку'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      {receipts.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : !receipts.data?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Приёмок пока нет. Создайте первую, чтобы оприходовать товар на склад.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {receipts.data.map((r) => (
            <Link key={r.id} href={`/receipts/${r.id}`}>
              <Card className="transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.receiptNumber}</span>
                      <ReceiptStatusBadge status={r.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.warehouse ? pickLocale(r.warehouse.name) : ''} · {r._count?.items ?? 0}{' '}
                      позиций · {r.totalQuantity} шт
                    </div>
                  </div>
                  <span className="text-sm text-primary">Открыть →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
