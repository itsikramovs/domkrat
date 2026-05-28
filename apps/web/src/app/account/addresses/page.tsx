'use client';

import { MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AddressForm } from '@/components/address-form';
import {
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateAddress,
} from '@/lib/api/users';
import { ApiHttpError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { UserAddress } from '@/lib/types';

export default function AddressesPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const addresses = useAddresses();
  const create = useCreateAddress();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserAddress | null>(null);

  useEffect(() => {
    if (accessToken === null) router.push('/login?next=/account/addresses');
  }, [accessToken, router]);
  if (!accessToken) return null;

  const onDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить адрес «${title}»?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Адрес удалён');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  const onSetDefault = async (id: string) => {
    try {
      await setDefault.mutateAsync(id);
      toast.success('Назначен основным');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  return (
    <div className="space-y-4 px-4 py-6 md:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Адреса доставки</h1>
        {!creating && !editing ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </button>
        ) : null}
      </div>

      {creating ? (
        <FormCard title="Новый адрес" onClose={() => setCreating(false)}>
          <AddressForm
            busy={create.isPending}
            submitLabel="Сохранить адрес"
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              try {
                await create.mutateAsync(input);
                toast.success('Адрес добавлен');
                setCreating(false);
              } catch (error) {
                toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
              }
            }}
          />
        </FormCard>
      ) : null}

      {editing ? (
        <EditCard
          address={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {addresses.isLoading ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : addresses.data && addresses.data.length > 0 ? (
        <ul className="space-y-3">
          {addresses.data.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">
                      {a.title ?? (a.isLegalEntity ? a.companyName ?? 'Юр. лицо' : 'Адрес')}
                    </h2>
                    {a.isDefault ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Основной
                      </span>
                    ) : null}
                    {a.isLegalEntity ? (
                      <span className="inline-flex items-center rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                        Юр. лицо
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.recipientName} · <span className="font-mono">{a.recipientPhone}</span>
                  </p>
                  <p className="mt-1 text-sm">
                    {a.city}
                    {a.district ? `, ${a.district}` : ''} · {a.addressLine}
                  </p>
                  {a.landmark ? (
                    <p className="text-xs text-muted-foreground">Ориентир: {a.landmark}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {!a.isDefault ? (
                  <button
                    type="button"
                    onClick={() => onSetDefault(a.id)}
                    disabled={setDefault.isPending}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 font-medium hover:bg-accent"
                  >
                    <Star className="h-3 w-3" />
                    Сделать основным
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(a);
                    setCreating(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 font-medium hover:bg-accent"
                >
                  <Pencil className="h-3 w-3" />
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(a.id, a.title ?? a.addressLine)}
                  disabled={remove.isPending}
                  className="ml-auto text-destructive hover:opacity-80"
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : !creating ? (
        <div className="space-y-4 rounded-2xl bg-card p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            У вас пока нет сохранённых адресов. Добавьте, чтобы быстрее оформлять заказы.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Добавить первый адрес
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FormCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function EditCard({ address, onClose }: { address: UserAddress; onClose: () => void }) {
  const update = useUpdateAddress(address.id);
  return (
    <FormCard title={`Изменить «${address.title ?? address.addressLine}»`} onClose={onClose}>
      <AddressForm
        initial={address}
        busy={update.isPending}
        submitLabel="Сохранить изменения"
        onCancel={onClose}
        onSubmit={async (input) => {
          try {
            await update.mutateAsync(input);
            toast.success('Сохранено');
            onClose();
          } catch (error) {
            toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
          }
        }}
      />
    </FormCard>
  );
}
