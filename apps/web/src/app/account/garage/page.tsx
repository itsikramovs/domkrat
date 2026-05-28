'use client';

import { Car, Plus, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/auth-store';
import { useDeleteGarage, useGarages, useUpdateGarage, type GarageEntry } from '@/lib/api/garage';
import { ApiHttpError } from '@/lib/api-client';

export default function GaragePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const garages = useGarages();

  useEffect(() => {
    if (accessToken === null) router.push('/login?next=/account/garage');
  }, [accessToken, router]);
  if (!accessToken) return null;

  return (
    <div className="space-y-4 px-4 py-6 md:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Мой гараж</h1>
        <Link
          href="/account/garage/add"
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить
        </Link>
      </div>

      {garages.isLoading ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : garages.data && garages.data.length > 0 ? (
        <ul className="space-y-3">
          {garages.data.map((g) => (
            <GarageCard key={g.id} g={g} />
          ))}
        </ul>
      ) : (
        <div className="space-y-4 rounded-2xl bg-card p-8 text-center">
          <Car className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Расскажите о вашем авто, чтобы мы показывали только совместимые запчасти.
          </p>
          <Link
            href="/account/garage/add"
            className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Добавить машину
          </Link>
        </div>
      )}
    </div>
  );
}

function GarageCard({ g }: { g: GarageEntry }) {
  const update = useUpdateGarage(g.id);
  const remove = useDeleteGarage();

  const title = g.carModification
    ? `${g.carModification.generation.model.make.name} ${g.carModification.generation.model.name}`
    : g.nickname ?? 'Авто';
  const subtitle = g.carModification
    ? `${g.carModification.generation.name} · ${g.carModification.name}`
    : null;

  const setPrimary = async () => {
    try {
      await update.mutateAsync({ isPrimary: true });
      toast.success('Назначено основным');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  const onRemove = async () => {
    if (!confirm(`Удалить ${title}?`)) return;
    try {
      await remove.mutateAsync(g.id);
      toast.success('Удалено');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Car className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold md:text-base">{title}</h2>
            {g.isPrimary ? (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                <Star className="h-2.5 w-2.5 fill-current" />
                Основное
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
            {g.year ? (
              <div>
                <dt className="inline">Год: </dt>
                <dd className="inline text-foreground">{g.year}</dd>
              </div>
            ) : null}
            {g.licensePlate ? (
              <div>
                <dt className="inline">Номер: </dt>
                <dd className="inline text-foreground font-mono">{g.licensePlate}</dd>
              </div>
            ) : null}
            {g.mileage ? (
              <div>
                <dt className="inline">Пробег: </dt>
                <dd className="inline text-foreground tabular-nums">
                  {g.mileage.toLocaleString('ru-RU')} км
                </dd>
              </div>
            ) : null}
            {g.vin ? (
              <div className="col-span-2 sm:col-span-4">
                <dt className="inline">VIN: </dt>
                <dd className="inline text-foreground font-mono">{g.vin}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {!g.isPrimary ? (
          <button
            type="button"
            onClick={setPrimary}
            disabled={update.isPending}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 font-medium hover:bg-accent"
          >
            <Star className="h-3 w-3" />
            Сделать основным
          </button>
        ) : null}
        <Link
          href={`/search?makeId=${g.carModification?.generation.model.make ? '' : ''}&modificationId=${g.carModification?.id ?? ''}&modificationName=${encodeURIComponent(title)}`}
          className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
        >
          Совместимые товары →
        </Link>
        <button
          type="button"
          onClick={onRemove}
          disabled={remove.isPending}
          className="text-destructive hover:opacity-80"
          aria-label="Удалить"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
