'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useAdminMerchants,
  useApproveMerchant,
  useRejectMerchant,
  useSuspendMerchant,
} from '@/lib/api/admin';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

export default function MerchantsPage() {
  return <AuthGate><MerchantsInner /></AuthGate>;
}

function MerchantsInner() {
  const [filter, setFilter] = useState<{ status?: string; verificationStatus?: string }>({});
  const merchants = useAdminMerchants(filter);
  const approve = useApproveMerchant();
  const reject = useRejectMerchant();
  const suspend = useSuspendMerchant();

  async function doApprove(id: string) {
    try {
      await approve.mutateAsync({ id });
      toast.success('Мерчант одобрен');
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

  async function doSuspend(id: string) {
    if (!confirm('Приостановить мерчанта?')) return;
    try {
      await suspend.mutateAsync(id);
      toast.success('Приостановлено');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? e.body.message : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold">Мерчанты</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterBtn active={!filter.status} onClick={() => setFilter({})}>Все</FilterBtn>
        {['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'].map((s) => (
          <FilterBtn key={s} active={filter.status === s} onClick={() => setFilter({ status: s })}>{s}</FilterBtn>
        ))}
      </div>

      {merchants.isLoading || !merchants.data ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-3">
          {merchants.data.data.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_auto] items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-lg font-semibold">{m.brandName}</div>
                    <Badge variant={m.status === 'ACTIVE' ? 'success' : m.status === 'PENDING' ? 'warning' : 'destructive'}>
                      {m.status}
                    </Badge>
                    <Badge variant="outline">{m.merchantType}</Badge>
                    <Badge variant="outline">{m.verificationStatus}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {m.legalName} · ИНН {m.taxId ?? '—'} · {m._count.products} товаров
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Владелец: {m.user.firstName} {m.user.lastName} ({m.user.email ?? m.user.phone})
                  </div>
                  {m.balance ? (
                    <div className="text-xs text-muted-foreground">
                      Available: {formatPrice(m.balance.availableBalance)} · Pending: {formatPrice(m.balance.pendingBalance)} · Заработано: {formatPrice(m.balance.totalEarned)}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.status === 'PENDING' || m.verificationStatus !== 'APPROVED' ? (
                    <>
                      <Button size="sm" onClick={() => doApprove(m.id)} disabled={approve.isPending}>Одобрить</Button>
                      <Button size="sm" variant="outline" onClick={() => doReject(m.id)} disabled={reject.isPending}>Отклонить</Button>
                    </>
                  ) : null}
                  {m.status === 'ACTIVE' ? (
                    <Button size="sm" variant="destructive" onClick={() => doSuspend(m.id)} disabled={suspend.isPending}>Приостановить</Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
          {merchants.data.data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Мерчантов не найдено</div>
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
