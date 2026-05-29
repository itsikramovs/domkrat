'use client';

import { Boxes, Plus, Warehouse as WhIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateWarehouse,
  useQuickAddCell,
  useWarehouseCells,
  useWarehouses,
} from '@/lib/api/inventory';
import { ApiHttpError } from '@/lib/api-client';
import { pickLocale } from '@/lib/utils';

export default function WarehousesPage() {
  const warehouses = useWarehouses();
  const createWh = useCreateWarehouse();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [city, setCity] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createWh.mutateAsync({
        code,
        name: { ru: nameRu, uz: nameRu },
        city: city || undefined,
      });
      toast.success('Склад создан');
      setCode('');
      setNameRu('');
      setCity('');
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Склады</h1>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'}>
          {showForm ? 'Закрыть' : '+ Создать склад'}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Код *</Label>
                <Input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="WH-1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Название *</Label>
                <Input
                  required
                  value={nameRu}
                  onChange={(e) => setNameRu(e.target.value)}
                  placeholder="Главный склад"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Город</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ташкент"
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={createWh.isPending}>
                  {createWh.isPending ? 'Создание…' : 'Создать'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {warehouses.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : !warehouses.data?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <WhIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Складов пока нет. Создайте первый — он понадобится для приёмки товара.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {warehouses.data.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{pickLocale(w.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {w.code} · {w.type} · {w.city ?? '—'} · {w._count?.zones ?? 0} зон
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(selected === w.id ? null : w.id)}
                  >
                    <Boxes className="h-4 w-4" /> Ячейки
                  </Button>
                </div>
                {selected === w.id ? <CellsPanel warehouseId={w.id} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CellsPanel({ warehouseId }: { warehouseId: string }) {
  const cells = useWarehouseCells(warehouseId);
  const addCell = useQuickAddCell();
  const [code, setCode] = useState('');

  async function add() {
    if (!code.trim()) return;
    try {
      await addCell.mutateAsync({ warehouseId, code: code.trim() });
      toast.success(`Ячейка ${code} добавлена`);
      setCode('');
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Код ячейки, напр. A-01"
          className="max-w-xs"
        />
        <Button size="sm" onClick={add} disabled={addCell.isPending}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>
      {cells.isLoading ? (
        <div className="text-xs text-muted-foreground">Загрузка ячеек…</div>
      ) : !cells.data?.length ? (
        <div className="text-xs text-muted-foreground">
          Ячеек нет — добавьте, чтобы размещать товар.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cells.data.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-lg border bg-secondary px-2 py-1 text-xs font-medium"
            >
              {c.code}
              {c._count?.inventoryBalances ? (
                <span className="text-muted-foreground">· {c._count.inventoryBalances} SKU</span>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
