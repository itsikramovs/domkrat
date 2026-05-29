'use client';

import { Boxes, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAdminAlerts,
  useAdminQuickCell,
  useAdminReceipts,
  useAdminWarehouseCells,
  useAdminWarehouses,
  useCreatePlatformWarehouse,
  useRunScan,
} from '@/lib/api/inventory';
import { ApiHttpError } from '@/lib/api-client';

export default function WarehousesPage() {
  return (
    <AuthGate>
      <WarehousesInner />
    </AuthGate>
  );
}

function WarehousesInner() {
  const [type, setType] = useState<string | undefined>(undefined);
  const warehouses = useAdminWarehouses(type);
  const create = useCreatePlatformWarehouse();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ code, name: { ru: name, uz: name }, city: city || undefined });
      toast.success('Платформенный склад создан');
      setCode('');
      setName('');
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
          {showForm ? 'Закрыть' : '+ Платформенный склад'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          ['Все', undefined],
          ['PLATFORM', 'PLATFORM'],
          ['MERCHANT', 'MERCHANT'],
          ['PARTNER', 'PARTNER'],
        ].map(([label, val]) => (
          <button
            key={label}
            type="button"
            onClick={() => setType(val as string | undefined)}
            className={`rounded border px-3 py-1 ${type === val ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <InventoryOversight />

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
                  placeholder="WH-TASH-1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Название *</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Склад платформы"
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
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Создание…' : 'Создать'}
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
            Складов не найдено
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {warehouses.data.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{w.name?.ru ?? w.code}</span>
                      <Badge variant={w.type === 'PLATFORM' ? 'success' : 'outline'}>
                        {w.type}
                      </Badge>
                      {!w.isActive ? <Badge variant="destructive">неактивен</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {w.code} · {w.city ?? '—'} · {w._count?.zones ?? 0} зон ·{' '}
                      {w._count?.stockReceipts ?? 0} приёмок
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
                {selected === w.id ? <Cells warehouseId={w.id} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Cells({ warehouseId }: { warehouseId: string }) {
  const cells = useAdminWarehouseCells(warehouseId);
  const add = useAdminQuickCell();
  const [code, setCode] = useState('');

  async function addCell() {
    if (!code.trim()) return;
    try {
      await add.mutateAsync({ warehouseId, code: code.trim() });
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
          placeholder="Код ячейки"
          className="max-w-xs"
        />
        <Button size="sm" onClick={addCell} disabled={add.isPending}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>
      {cells.isLoading ? (
        <div className="text-xs text-muted-foreground">Загрузка…</div>
      ) : !cells.data?.length ? (
        <div className="text-xs text-muted-foreground">Ячеек нет.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cells.data.map((c) => (
            <span
              key={c.id}
              className="rounded-lg border bg-secondary px-2 py-1 text-xs font-medium"
            >
              {c.code}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryOversight() {
  const alerts = useAdminAlerts();
  const receipts = useAdminReceipts();
  const scan = useRunScan();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Алерты остатков ({alerts.data?.length ?? 0})</h2>
            <Button
              size="sm"
              variant="outline"
              disabled={scan.isPending}
              onClick={async () => {
                try {
                  await scan.mutateAsync();
                  toast.success('Скан запущен');
                } catch {
                  toast.error('Ошибка');
                }
              }}
            >
              Запустить скан
            </Button>
          </div>
          {!alerts.data?.length ? (
            <div className="text-sm text-muted-foreground">Активных алертов нет.</div>
          ) : (
            <div className="space-y-1 text-sm">
              {alerts.data.slice(0, 12).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border-b py-1 last:border-0"
                >
                  <span>
                    <Badge variant={a.severity === 'CRITICAL' ? 'destructive' : 'warning'}>
                      {a.alertType}
                    </Badge>{' '}
                    {a.product.sku} · {a.merchant.brandName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-2 font-semibold">Последние приёмки</h2>
          {!receipts.data?.length ? (
            <div className="text-sm text-muted-foreground">Приёмок нет.</div>
          ) : (
            <div className="space-y-1 text-sm">
              {receipts.data.slice(0, 12).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b py-1 last:border-0"
                >
                  <span>
                    {r.receiptNumber} · {r.merchant?.brandName ?? '—'}
                  </span>
                  <Badge variant={r.status === 'COMPLETED' ? 'success' : 'secondary'}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
