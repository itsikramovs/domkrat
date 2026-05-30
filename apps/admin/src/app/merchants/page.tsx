'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { MerchantDocuments } from '@/components/merchant-documents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAdminMerchants,
  useApproveMerchant,
  useBanMerchant,
  useCreateMerchant,
  useRejectMerchant,
  useSuspendMerchant,
  type CreateMerchantInput,
} from '@/lib/api/admin';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

export default function MerchantsPage() {
  return (
    <AuthGate>
      <MerchantsInner />
    </AuthGate>
  );
}

function MerchantsInner() {
  const [filter, setFilter] = useState<{ status?: string; verificationStatus?: string }>({});
  const [showCreate, setShowCreate] = useState(false);
  const merchants = useAdminMerchants(filter);
  const approve = useApproveMerchant();
  const reject = useRejectMerchant();
  const suspend = useSuspendMerchant();
  const ban = useBanMerchant();

  async function doBan(id: string) {
    if (!confirm('Заблокировать мерчанта (BANNED)? Действие жёсткое.')) return;
    try {
      await ban.mutateAsync(id);
      toast.success('Мерчант заблокирован');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? e.body.message : 'Ошибка');
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Мерчанты</h1>
        <Button
          onClick={() => setShowCreate((v) => !v)}
          variant={showCreate ? 'outline' : 'default'}
        >
          {showCreate ? 'Закрыть форму' : '+ Создать мерчанта'}
        </Button>
      </div>

      {showCreate ? <CreateMerchantForm onDone={() => setShowCreate(false)} /> : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterBtn active={!filter.status} onClick={() => setFilter({})}>
          Все
        </FilterBtn>
        {['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'].map((s) => (
          <FilterBtn key={s} active={filter.status === s} onClick={() => setFilter({ status: s })}>
            {s}
          </FilterBtn>
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
                    <Badge
                      variant={
                        m.status === 'ACTIVE'
                          ? 'success'
                          : m.status === 'PENDING'
                            ? 'warning'
                            : 'destructive'
                      }
                    >
                      {m.status}
                    </Badge>
                    <Badge variant="outline">{m.merchantType}</Badge>
                    <Badge variant="outline">{m.verificationStatus}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {m.legalName} · ИНН {m.taxId ?? '—'} · {m._count.productOffers} предложений
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Владелец: {m.user.firstName} {m.user.lastName} ({m.user.email ?? m.user.phone})
                  </div>
                  {m.balance ? (
                    <div className="text-xs text-muted-foreground">
                      Available: {formatPrice(m.balance.availableBalance)} · Pending:{' '}
                      {formatPrice(m.balance.pendingBalance)} · Заработано:{' '}
                      {formatPrice(m.balance.totalEarned)}
                    </div>
                  ) : null}
                  <MerchantDocuments merchantId={m.id} count={m._count.documents} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.status === 'PENDING' || m.verificationStatus !== 'APPROVED' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => doApprove(m.id)}
                        disabled={approve.isPending}
                      >
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => doReject(m.id)}
                        disabled={reject.isPending}
                      >
                        Отклонить
                      </Button>
                    </>
                  ) : null}
                  {m.status === 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => doSuspend(m.id)}
                      disabled={suspend.isPending}
                    >
                      Приостановить
                    </Button>
                  ) : null}
                  {m.status === 'ACTIVE' || m.status === 'SUSPENDED' ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => doBan(m.id)}
                      disabled={ban.isPending}
                    >
                      Заблокировать
                    </Button>
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

function FilterBtn({
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
      className={`px-3 py-1 rounded border ${active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
    >
      {children}
    </button>
  );
}

const EMPTY_FORM: CreateMerchantInput = {
  ownerEmail: '',
  ownerPassword: '',
  ownerFirstName: '',
  ownerLastName: '',
  ownerPhone: '',
  merchantType: 'TYPE_2',
  legalType: 'LLC',
  legalName: '',
  brandName: '',
  slug: '',
  contactPhone: '',
  contactEmail: '',
  taxId: '',
};

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function CreateMerchantForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<CreateMerchantInput>(EMPTY_FORM);
  const create = useCreateMerchant();
  const set = <K extends keyof CreateMerchantInput>(k: K, v: CreateMerchantInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // отсекаем пустые опциональные поля
    const payload: CreateMerchantInput = { ...form };
    (['ownerPhone', 'slug', 'contactPhone', 'contactEmail', 'taxId'] as const).forEach((k) => {
      if (!payload[k]) delete payload[k];
    });
    try {
      const m = (await create.mutateAsync(payload)) as { brandName: string };
      toast.success(`Мерчант «${m.brandName}» создан`);
      setForm(EMPTY_FORM);
      onDone();
    } catch (err) {
      const msg = err instanceof ApiHttpError ? err.body.message : 'Ошибка создания';
      toast.error(Array.isArray(msg) ? msg.join('; ') : msg);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="text-sm font-semibold text-muted-foreground">
            Владелец (вход в кабинет)
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email *">
              <Input
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => set('ownerEmail', e.target.value)}
              />
            </Field>
            <Field label="Пароль * (мин. 8, буква и цифра)">
              <Input
                type="text"
                required
                value={form.ownerPassword}
                onChange={(e) => set('ownerPassword', e.target.value)}
              />
            </Field>
            <Field label="Имя *">
              <Input
                required
                value={form.ownerFirstName}
                onChange={(e) => set('ownerFirstName', e.target.value)}
              />
            </Field>
            <Field label="Фамилия *">
              <Input
                required
                value={form.ownerLastName}
                onChange={(e) => set('ownerLastName', e.target.value)}
              />
            </Field>
            <Field label="Телефон владельца (+998…)">
              <Input value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} />
            </Field>
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Компания</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Бренд (витрина) *">
              <Input
                required
                value={form.brandName}
                onChange={(e) => set('brandName', e.target.value)}
              />
            </Field>
            <Field label="Юр. название *">
              <Input
                required
                value={form.legalName}
                onChange={(e) => set('legalName', e.target.value)}
              />
            </Field>
            <Field label="Тип мерчанта">
              <select
                className={selectCls}
                value={form.merchantType}
                onChange={(e) =>
                  set('merchantType', e.target.value as CreateMerchantInput['merchantType'])
                }
              >
                <option value="TYPE_2">TYPE_2 — свой склад (FBS)</option>
                <option value="TYPE_1">TYPE_1 — склад платформы (FBO)</option>
              </select>
            </Field>
            <Field label="Форма">
              <select
                className={selectCls}
                value={form.legalType}
                onChange={(e) =>
                  set('legalType', e.target.value as CreateMerchantInput['legalType'])
                }
              >
                <option value="LLC">ООО (LLC)</option>
                <option value="IE">ИП (IE)</option>
                <option value="INDIVIDUAL">Физлицо</option>
                <option value="OTHER">Другое</option>
              </select>
            </Field>
            <Field label="Slug (необязательно)">
              <Input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="autoparts-uz"
              />
            </Field>
            <Field label="ИНН (taxId)">
              <Input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} />
            </Field>
            <Field label="Контактный телефон">
              <Input
                value={form.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value)}
              />
            </Field>
            <Field label="Контактный email">
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set('contactEmail', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Создание…' : 'Создать мерчанта'}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Отмена
            </Button>
          </div>
        </form>
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
