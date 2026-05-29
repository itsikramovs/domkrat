'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAlertAction,
  useAlerts,
  useBalances,
  useInventorySummary,
  useMovements,
} from '@/lib/api/inventory';
import { pickLocale } from '@/lib/utils';

const MOVEMENT_LABELS: Record<string, string> = {
  RECEIPT: 'Приёмка',
  RESERVE: 'Резерв',
  UNRESERVE: 'Снят резерв',
  SHIPMENT: 'Отгрузка',
  TRANSFER: 'Перемещение',
  RETURN: 'Возврат',
  ADJUSTMENT_PLUS: 'Коррекция +',
  ADJUSTMENT_MINUS: 'Коррекция −',
  WRITE_OFF: 'Списание',
  INVENTORY: 'Инвентаризация',
};

export default function InventoryPage() {
  const summary = useInventorySummary();
  const [byCell, setByCell] = useState(false);
  const balances = useBalances(byCell);
  const movements = useMovements();
  const s = summary.data;

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Остатки и движения</h1>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="SKU на складе" value={s?.skuCount ?? '—'} />
        <Stat label="Доступно к продаже" value={s?.totalAvailable ?? '—'} />
        <Stat label="В резерве" value={s?.totalReserved ?? '—'} />
        <Stat
          label="Заканчивается (≤5)"
          value={s?.lowStockCount ?? '—'}
          accent={!!s?.lowStockCount}
        />
      </div>

      <AlertsSection />

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Остатки</h2>
            <div className="flex gap-1 text-sm">
              <Toggle active={!byCell} onClick={() => setByCell(false)}>
                Сводно
              </Toggle>
              <Toggle active={byCell} onClick={() => setByCell(true)}>
                По ячейкам
              </Toggle>
            </div>
          </div>
          {balances.isLoading ? (
            <div className="text-sm text-muted-foreground">Загрузка…</div>
          ) : !balances.data?.length ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Остатков нет. Создайте приёмку — после размещения товар появится здесь.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2">Товар</th>
                    <th>SKU</th>
                    {byCell ? <th>Ячейка</th> : null}
                    <th className="text-right">Доступно</th>
                    <th className="text-right">Резерв</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.data.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{pickLocale(b.product.name)}</td>
                      <td className="text-muted-foreground">{b.product.sku}</td>
                      {byCell ? <td>{b.cell?.code ?? '—'}</td> : null}
                      <td className="text-right font-semibold tabular-nums">
                        {b.quantityAvailable}
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {b.quantityReserved}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Последние движения</h2>
          {movements.isLoading ? (
            <div className="text-sm text-muted-foreground">Загрузка…</div>
          ) : !movements.data?.length ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Движений пока нет.</div>
          ) : (
            <div className="space-y-1 text-sm">
              {movements.data.slice(0, 40).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b py-1.5 last:border-0"
                >
                  <div>
                    <span className="font-medium">
                      {MOVEMENT_LABELS[m.movementType] ?? m.movementType}
                    </span>
                    <span className="text-muted-foreground"> · {pickLocale(m.product.name)}</span>
                    {m.toCell ? (
                      <span className="text-muted-foreground"> → {m.toCell.code}</span>
                    ) : null}
                  </div>
                  <span
                    className={`font-semibold tabular-nums ${m.quantity >= 0 ? 'text-hit' : 'text-sale'}`}
                  >
                    {m.quantity >= 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${accent ? 'text-sale' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1 ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
    >
      {children}
    </button>
  );
}

function AlertsSection() {
  const alerts = useAlerts();
  const resolve = useAlertAction('resolve');
  const dismiss = useAlertAction('dismiss');
  if (!alerts.data?.length) return null;

  const sevClass = (s: string) =>
    s === 'CRITICAL'
      ? 'border-sale/40 bg-sale/5'
      : s === 'WARNING'
        ? 'border-warning/40 bg-warning/5'
        : 'border-border';

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch {
      toast.error('Ошибка');
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 font-semibold">Алерты ({alerts.data.length})</h2>
        <div className="space-y-2">
          {alerts.data.map((a) => (
            <div
              key={a.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${sevClass(a.severity)}`}
            >
              <div className="text-sm">
                <span className="font-medium">{pickLocale(a.message)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {pickLocale(a.product.name)} ({a.product.sku})
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(() => resolve.mutateAsync(a.id), 'Решено')}
                >
                  Решено
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => act(() => dismiss.mutateAsync(a.id), 'Скрыто')}
                >
                  Скрыть
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
