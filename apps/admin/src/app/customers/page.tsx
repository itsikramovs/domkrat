'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import {
  useCustomer,
  useCustomers,
  useSetUserStatus,
  type AdminCustomer,
} from '@/lib/api/management';
import { formatPrice } from '@/lib/utils';

const ORDER_STATUS_LABEL: Record<string, string> = {
  CREATED: 'Создан',
  PAID: 'Оплачен',
  PROCESSING: 'В обработке',
  ASSEMBLED: 'Собран',
  SHIPPED: 'Отправлен',
  OUT_FOR_DELIVERY: 'В доставке',
  DELIVERED: 'Доставлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  REFUND_REQUESTED: 'Запрос возврата',
  REFUNDED: 'Возврат',
  RETURNED: 'Возвращён',
};

function errMsg(err: unknown): string {
  return err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка';
}

function fullName(c: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  id: string;
}) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.id.slice(0, 8);
}

export default function CustomersPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [search, setSearch] = useState('');
  const customers = useCustomers(search || undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = customers.data?.data ?? [];

  return (
    <div className="container space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Клиенты</h1>
        <p className="text-sm text-muted-foreground">
          {customers.data ? `${customers.data.meta.total} клиентов` : 'Покупатели платформы'}
        </p>
      </div>

      <Input
        placeholder="Поиск по имени, email или телефону…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {customers.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <CustomerRow
              key={c.id}
              c={c}
              open={openId === c.id}
              onToggle={() => setOpenId((id) => (id === c.id ? null : c.id))}
            />
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Клиентов не найдено</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  c,
  open,
  onToggle,
}: {
  c: AdminCustomer;
  open: boolean;
  onToggle: () => void;
}) {
  const setStatus = useSetUserStatus();

  async function toggleActive() {
    try {
      await setStatus.mutateAsync({ id: c.id, isActive: !c.isActive });
      toast.success(c.isActive ? 'Заблокирован' : 'Активирован');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{fullName(c)}</span>
              {!c.isActive ? <Badge variant="destructive">заблокирован</Badge> : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {c.email ?? '—'}
              {c.phone ? ` · ${c.phone}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold">{formatPrice(c.totalSpent)}</div>
              <div className="text-xs text-muted-foreground">{c.ordersCount} заказов</div>
            </div>
            <Button size="sm" variant="ghost" onClick={toggleActive} disabled={setStatus.isPending}>
              {c.isActive ? 'Блок' : 'Актив'}
            </Button>
            <Button size="sm" variant="outline" onClick={onToggle}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {open ? <CustomerDetail id={c.id} /> : null}
      </CardContent>
    </Card>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const detail = useCustomer(id);

  if (detail.isLoading || !detail.data) {
    return <div className="mt-3 text-sm text-muted-foreground">Загрузка…</div>;
  }
  const d = detail.data;

  return (
    <div className="mt-3 grid gap-4 border-t pt-3 sm:grid-cols-2">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Профиль</div>
        <dl className="space-y-1 text-sm">
          <Row k="Регистрация" v={new Date(d.createdAt).toLocaleDateString('ru-RU')} />
          <Row
            k="Последний вход"
            v={d.lastLoginAt ? new Date(d.lastLoginAt).toLocaleString('ru-RU') : '—'}
          />
          <Row k="Email подтверждён" v={d.isEmailVerified ? 'да' : 'нет'} />
          <Row k="Язык" v={d.preferredLanguage.toUpperCase()} />
        </dl>

        <div className="pt-2 text-xs font-semibold uppercase text-muted-foreground">Адреса</div>
        {d.addresses.length ? (
          <ul className="space-y-1 text-sm">
            {d.addresses.map((a) => (
              <li key={a.id}>
                {a.city}, {a.addressLine}
                {a.isDefault ? <span className="text-muted-foreground"> · основной</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Нет адресов</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Последние заказы
        </div>
        {d.recentOrders.length ? (
          <div className="space-y-1">
            {d.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-mono text-xs">{o.orderNumber}</span>
                <Badge variant="secondary">{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(o.placedAt).toLocaleDateString('ru-RU')}
                </span>
                <span className="font-medium">{formatPrice(o.totalAmount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Заказов нет</p>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
