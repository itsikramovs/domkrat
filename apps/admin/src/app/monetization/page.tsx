'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminMerchants, type AdminMerchant } from '@/lib/api/admin';
import { ApiHttpError } from '@/lib/api-client';
import {
  useAdminPromoCodes,
  useDeletePromoCode,
  useSavePromoCode,
  useSetMerchantCommission,
  type AdminPromoCode,
  type PromoDiscountType,
} from '@/lib/api/management';
import { formatPrice } from '@/lib/utils';

function errMsg(err: unknown): string {
  return err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка';
}

export default function MonetizationPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [tab, setTab] = useState<'promo' | 'commission'>('promo');

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Монетизация</h1>

      <div className="flex gap-1">
        <TabBtn active={tab === 'promo'} onClick={() => setTab('promo')}>
          Промокоды
        </TabBtn>
        <TabBtn active={tab === 'commission'} onClick={() => setTab('commission')}>
          Комиссии мерчантов
        </TabBtn>
      </div>

      {tab === 'promo' ? <PromoTab /> : <CommissionTab />}
    </div>
  );
}

function TabBtn({
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
      onClick={onClick}
      className={`rounded-md border px-4 py-1.5 text-sm font-medium ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
      }`}
    >
      {children}
    </button>
  );
}

// ----------------------------- Promo codes -----------------------------
function todayISO(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function PromoTab() {
  const promos = useAdminPromoCodes();
  const save = useSavePromoCode();
  const del = useDeletePromoCode();

  const [editing, setEditing] = useState<AdminPromoCode | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<PromoDiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('');
  const [validFrom, setValidFrom] = useState(todayISO());
  const [validUntil, setValidUntil] = useState(todayISO(30));
  const [isActive, setIsActive] = useState(true);

  const list = promos.data?.data ?? [];
  const isPct = discountType === 'PERCENTAGE';

  function start(p: AdminPromoCode | null) {
    setEditing(p);
    setCode(p?.code ?? '');
    setDiscountType(p?.discountType ?? 'PERCENTAGE');
    setDiscountValue(p?.discountValue ?? '10');
    setMaxDiscount(p?.maxDiscountAmount ?? '');
    setMinOrder(p?.minOrderAmount ?? '');
    setUsageLimit(p?.usageLimit != null ? String(p.usageLimit) : '');
    setPerUserLimit(p?.perUserLimit != null ? String(p.perUserLimit) : '');
    setValidFrom((p?.validFrom ?? new Date().toISOString()).slice(0, 10));
    setValidUntil((p?.validUntil ?? todayISO(30)).slice(0, 10));
    setIsActive(p?.isActive ?? true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      code,
      discountType,
      discountValue: Number(discountValue),
      isActive,
      validFrom: new Date(validFrom).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      ...(isPct && maxDiscount ? { maxDiscountAmount: Number(maxDiscount) } : {}),
      ...(minOrder ? { minOrderAmount: Number(minOrder) } : {}),
      ...(usageLimit ? { usageLimit: Number(usageLimit) } : {}),
      ...(perUserLimit ? { perUserLimit: Number(perUserLimit) } : {}),
    };
    try {
      await save.mutateAsync({ id: editing?.id, body });
      toast.success(editing ? 'Сохранено' : 'Промокод создан');
      start(null);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить промокод?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Удалено');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm font-semibold">
            {editing ? `Редактирование ${editing.code}` : 'Новый промокод'}
          </div>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Код *">
              <Input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
              />
            </Field>
            <Field label="Тип скидки *">
              <Select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
              >
                <option value="PERCENTAGE">Процент (%)</option>
                <option value="FIXED">Фикс. сумма (сум)</option>
              </Select>
            </Field>
            <Field label={isPct ? 'Процент (1–100) *' : 'Сумма скидки *'}>
              <Input
                required
                type="number"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </Field>
            {isPct ? (
              <Field label="Макс. скидка (сум)">
                <Input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  placeholder="без лимита"
                />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Мин. сумма заказа">
              <Input
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="нет"
              />
            </Field>
            <Field label="Лимит всего">
              <Input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="∞"
              />
            </Field>
            <Field label="Лимит на пользователя">
              <Input
                type="number"
                value={perUserLimit}
                onChange={(e) => setPerUserLimit(e.target.value)}
                placeholder="∞"
              />
            </Field>
            <Field label="Действует с *">
              <Input
                type="date"
                required
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </Field>
            <Field label="Действует по *">
              <Input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Активен
              </label>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={save.isPending}>
                {editing ? 'Сохранить' : 'Создать'}
              </Button>
              {editing ? (
                <Button type="button" variant="outline" onClick={() => start(null)}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {promos.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{p.code}</span>
                    <Badge variant="secondary">
                      {p.discountType === 'PERCENTAGE'
                        ? `${p.discountValue}%`
                        : formatPrice(p.discountValue)}
                    </Badge>
                    {p.isActive ? (
                      <Badge variant="outline">активен</Badge>
                    ) : (
                      <Badge variant="destructive">выключен</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    исп. {p.usageCount}
                    {p.usageLimit != null ? `/${p.usageLimit}` : ''}
                    {p.minOrderAmount ? ` · мин. ${formatPrice(p.minOrderAmount)}` : ''} · до{' '}
                    {new Date(p.validUntil).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => start(p)}>
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(p.id)}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Промокодов пока нет</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ----------------------------- Commission -----------------------------
function CommissionTab() {
  const merchants = useAdminMerchants({ status: 'ACTIVE' });
  const list = merchants.data?.data ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Ставка комиссии применяется при расчёте заказа (удерживается с оборота мерчанта). По
        умолчанию 10%, если не задана.
      </p>
      {merchants.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((m) => (
            <CommissionRow key={m.id} m={m} />
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Активных мерчантов нет</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CommissionRow({ m }: { m: AdminMerchant }) {
  const setCommission = useSetMerchantCommission();
  const [rate, setRate] = useState(m.commissionRate ?? '10');

  async function save() {
    const value = Number(rate);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Ставка должна быть от 0 до 100');
      return;
    }
    try {
      await setCommission.mutateAsync({ id: m.id, commissionRate: value });
      toast.success(`${m.brandName}: комиссия ${value}%`);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  const dirty = rate !== (m.commissionRate ?? '10');

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="font-medium">{m.brandName}</div>
          <div className="text-xs text-muted-foreground">{m.slug}</div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button size="sm" onClick={save} disabled={!dirty || setCommission.isPending}>
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
    />
  );
}
