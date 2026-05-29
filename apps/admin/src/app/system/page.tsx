'use client';

import { Database, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRunScan } from '@/lib/api/inventory';
import { useRebuildSearch, useRunHoldRelease } from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';

export default function SystemPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const rebuild = useRebuildSearch();
  const hold = useRunHoldRelease();
  const scan = useRunScan();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      const res = await fn();
      toast.success(ok + (res && typeof res === 'object' ? ` — ${JSON.stringify(res)}` : ''));
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  };

  const actions = [
    {
      icon: Search,
      title: 'Переиндексация поиска',
      desc: 'Перестроить индекс Meilisearch по всем товарам.',
      cta: 'Переиндексировать',
      pending: rebuild.isPending,
      run: () => run(() => rebuild.mutateAsync(), 'Индекс перестроен'),
    },
    {
      icon: Database,
      title: 'Разморозка средств (hold-release)',
      desc: 'Перевести доступные к выплате суммы мерчантов по истечении hold-периода.',
      cta: 'Запустить',
      pending: hold.isPending,
      run: () => run(() => hold.mutateAsync(), 'Hold-release выполнен'),
    },
    {
      icon: RefreshCw,
      title: 'Скан остатков',
      desc: 'Сгенерировать алерты low-stock / залежавшегося товара.',
      cta: 'Сканировать',
      pending: scan.isPending,
      run: () => run(() => scan.mutateAsync(), 'Скан выполнен'),
    },
  ];

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Система</h1>
      <p className="text-sm text-muted-foreground">
        Ручной запуск фоновых задач. Обычно выполняются по расписанию (cron).
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Card key={a.title}>
              <CardContent className="space-y-3 p-5">
                <Icon className="h-6 w-6 text-primary" />
                <div className="font-semibold">{a.title}</div>
                <div className="text-sm text-muted-foreground">{a.desc}</div>
                <Button onClick={a.run} disabled={a.pending}>
                  {a.pending ? 'Выполняется…' : a.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
