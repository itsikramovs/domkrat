'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAdminWithdrawals,
  useApproveWithdrawal,
  useCompleteWithdrawal,
  useRejectWithdrawal,
} from '@/lib/api/admin';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

const STATUSES = ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'];

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  APPROVED: 'default',
  PROCESSING: 'default',
  COMPLETED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

export default function WithdrawalsPage() {
  return <AuthGate><Inner /></AuthGate>;
}

function Inner() {
  const [filter, setFilter] = useState<string | undefined>('PENDING');
  const wd = useAdminWithdrawals(filter);
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();
  const complete = useCompleteWithdrawal();

  async function doApprove(id: string) {
    try {
      await approve.mutateAsync({ id });
      toast.success('Одобрено');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? e.body.message : 'Ошибка');
    }
  }

  async function doReject(id: string) {
    const reason = prompt('Причина отказа?');
    if (!reason) return;
    try {
      await reject.mutateAsync({ id, reason });
      toast.success('Отклонено');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? e.body.message : 'Ошибка');
    }
  }

  async function doComplete(id: string) {
    const ext = prompt('ID банковской операции?');
    if (!ext) return;
    try {
      await complete.mutateAsync({ id, externalTransactionId: ext });
      toast.success('Выплата завершена');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? e.body.message : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold">Заявки на вывод</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterBtn active={!filter} onClick={() => setFilter(undefined)}>Все</FilterBtn>
        {STATUSES.map((s) => (
          <FilterBtn key={s} active={filter === s} onClick={() => setFilter(s)}>{s}</FilterBtn>
        ))}
      </div>

      {wd.isLoading || !wd.data ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-3">
          {wd.data.data.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_auto] items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-mono font-semibold">{w.requestNumber}</div>
                    <Badge variant={STATUS_VARIANT[w.status] ?? 'default'}>{w.status}</Badge>
                  </div>
                  <div className="text-lg font-bold">{formatPrice(w.amount)}</div>
                  <div className="text-sm text-muted-foreground">
                    {w.merchant.brandName} ({w.merchant.contactEmail ?? '—'})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.bankName} · {w.bankAccount} · {w.recipientName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Запрошено: {new Date(w.requestedAt).toLocaleString('ru-RU')}
                    {w.processedAt ? ` · обработано: ${new Date(w.processedAt).toLocaleString('ru-RU')}` : ''}
                  </div>
                  {w.notes ? <div className="text-xs">Заметка: {w.notes}</div> : null}
                  {w.rejectionReason ? <div className="text-xs text-destructive">Причина отказа: {w.rejectionReason}</div> : null}
                  {w.externalTransactionId ? <div className="text-xs">Bank tx: {w.externalTransactionId}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {w.status === 'PENDING' ? (
                    <>
                      <Button size="sm" onClick={() => doApprove(w.id)} disabled={approve.isPending}>Одобрить</Button>
                      <Button size="sm" variant="outline" onClick={() => doReject(w.id)} disabled={reject.isPending}>Отклонить</Button>
                    </>
                  ) : null}
                  {w.status === 'APPROVED' || w.status === 'PROCESSING' ? (
                    <Button size="sm" onClick={() => doComplete(w.id)} disabled={complete.isPending}>Отметить выплаченным</Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
          {wd.data.data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Заявок не найдено</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded border ${active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
    >
      {children}
    </button>
  );
}
