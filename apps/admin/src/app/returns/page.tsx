'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminReturns, useReturnAction } from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

const TABS = ['', 'REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'];

export default function ReturnsPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [status, setStatus] = useState('');
  const returns = useAdminReturns(status || undefined);
  const approve = useReturnAction('approve');
  const reject = useReturnAction('reject');
  const complete = useReturnAction('complete');
  const list = returns.data?.data ?? [];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Возвраты</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {TABS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded border px-3 py-1 ${status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            {s || 'Все'}
          </button>
        ))}
      </div>

      {returns.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">Возвратов нет</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.returnNumber ?? r.id.slice(0, 8)}</span>
                    <Badge
                      variant={
                        r.status === 'COMPLETED'
                          ? 'success'
                          : r.status === 'REJECTED'
                            ? 'destructive'
                            : 'warning'
                      }
                    >
                      {r.status}
                    </Badge>
                    {r.refundAmount ? (
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(r.refundAmount)}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">{r.reason}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.user?.firstName} {r.user?.lastName} ({r.user?.email})
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['REQUESTED', 'PENDING'].includes(r.status) ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => run(() => approve.mutateAsync({ id: r.id }), 'Одобрено')}
                      >
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reason = prompt('Причина отказа?');
                          if (reason)
                            run(() => reject.mutateAsync({ id: r.id, reason }), 'Отклонено');
                        }}
                      >
                        Отклонить
                      </Button>
                    </>
                  ) : null}
                  {r.status === 'APPROVED' ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        run(() => complete.mutateAsync({ id: r.id }), 'Возврат завершён')
                      }
                    >
                      Завершить возврат
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
