'use client';

import { ClipboardCheck, Play, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import {
  useAdminWarehouses,
  useCompleteStockCount,
  useCreateStockCount,
  useSaveStockCount,
  useStockCount,
  useStockCounts,
} from '@/lib/api/inventory';

export default function AdminCountPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const warehouses = useAdminWarehouses();
  const counts = useStockCounts();
  const create = useCreateStockCount();
  const [warehouseId, setWarehouseId] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useStockCount(activeId);
  const save = useSaveStockCount();
  const complete = useCompleteStockCount();
  const [vals, setVals] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!active.data?.items) return;
    setVals(
      Object.fromEntries(active.data.items.map((i) => [i.id, i.countedQty ?? i.expectedQty])),
    );
  }, [active.data]);

  async function start() {
    if (!warehouseId) return toast.error('Выберите склад');
    try {
      const c = await create.mutateAsync({ warehouseId });
      setActiveId(c.id);
      toast.success(`Ревизия создана: ${c.items?.length ?? 0} позиций`);
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  async function doSave() {
    if (!activeId || !active.data?.items) return;
    try {
      await save.mutateAsync({
        id: activeId,
        items: active.data.items.map((i) => ({ itemId: i.id, countedQty: vals[i.id] ?? 0 })),
      });
      toast.success('Сохранено');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  async function doComplete() {
    if (!activeId) return;
    await doSave();
    try {
      await complete.mutateAsync(activeId);
      toast.success('Ревизия завершена — остатки скорректированы');
      setActiveId(null);
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  const items = active.data?.items ?? [];
  const isOpen = active.data?.status === 'IN_PROGRESS';

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Инвентаризация</h1>
      </div>

      {!activeId ? (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Склад</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="h-10 w-72 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— выбрать склад —</option>
                {(warehouses.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name?.ru} ({w.type})
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={start} disabled={!warehouseId || create.isPending}>
              <Play className="mr-2 h-4 w-4" /> Начать ревизию
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Пересчёт по ячейкам ({items.length})</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}>
                Закрыть
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Ячейка</th>
                    <th className="px-2 py-2 text-left">Товар / SKU</th>
                    <th className="px-2 py-2 text-right">Ожидается</th>
                    <th className="px-2 py-2 text-right">Факт</th>
                    <th className="px-2 py-2 text-right">Расхождение</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((i) => {
                    const diff = (vals[i.id] ?? 0) - i.expectedQty;
                    return (
                      <tr key={i.id}>
                        <td className="px-2 py-2 font-mono text-xs">{i.cellCode}</td>
                        <td className="px-2 py-2">
                          <div className="truncate">{i.productName?.ru ?? i.sku}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{i.sku}</div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{i.expectedQty}</td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={vals[i.id] ?? 0}
                            disabled={!isOpen}
                            onChange={(e) =>
                              setVals((v) => ({ ...v, [i.id]: Number(e.target.value) }))
                            }
                            className="ml-auto h-8 w-24 text-right tabular-nums"
                          />
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums ${diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-emerald-600' : 'text-destructive'}`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isOpen ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={doSave} disabled={save.isPending}>
                  <Save className="mr-2 h-4 w-4" /> Сохранить
                </Button>
                <Button onClick={doComplete} disabled={complete.isPending}>
                  Завершить → скорректировать остатки
                </Button>
              </div>
            ) : (
              <Badge variant="secondary">Завершена</Badge>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Недавние ревизии</h2>
          {(counts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Ревизий пока нет.</p>
          ) : (
            <div className="divide-y">
              {(counts.data ?? []).map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center justify-between py-2 text-left text-sm hover:bg-muted/30"
                  onClick={() => setActiveId(c.id)}
                >
                  <span className="font-mono text-xs">{c.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString('ru-RU')} · {c._count?.items ?? 0} поз.
                  </span>
                  <Badge variant={c.status === 'COMPLETED' ? 'success' : 'default'}>
                    {c.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
