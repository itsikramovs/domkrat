'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAdminBrands,
  useDeleteBrand,
  useSaveBrand,
  type AdminBrand,
} from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';

export default function BrandsPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const brands = useAdminBrands();
  const save = useSaveBrand();
  const del = useDeleteBrand();
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [country, setCountry] = useState('');

  const list = brands.data ?? [];

  function startEdit(b: AdminBrand | null) {
    setEditing(b);
    setName(b?.name ?? '');
    setSlug(b?.slug ?? '');
    setCountry(b?.countryOfOrigin ?? '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        id: editing?.id,
        body: { name, slug, ...(country ? { countryOfOrigin: country } : {}) },
      });
      toast.success(editing ? 'Сохранено' : 'Бренд создан');
      startEdit(null);
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить бренд?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Удалено');
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Бренды</h1>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm font-semibold">
            {editing ? 'Редактирование' : 'Новый бренд'}
          </div>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
            <Field label="Название *">
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bosch"
              />
            </Field>
            <Field label="Slug *">
              <Input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="bosch"
              />
            </Field>
            <Field label="Страна">
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Германия"
              />
            </Field>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" disabled={save.isPending}>
                {editing ? 'Сохранить' : 'Создать'}
              </Button>
              {editing ? (
                <Button type="button" variant="outline" onClick={() => startEdit(null)}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {brands.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    · {b.slug} · {b.countryOfOrigin ?? '—'} · {b._count?.products ?? 0} товаров
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(b)}>
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(b.id)}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
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
