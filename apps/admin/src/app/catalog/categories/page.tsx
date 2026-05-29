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
  useAdminCategories,
  useDeleteCategory,
  useSaveCategory,
  type AdminCategory,
} from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';

export default function CategoriesPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const categories = useAdminCategories();
  const save = useSaveCategory();
  const del = useDeleteCategory();
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [ru, setRu] = useState('');
  const [uz, setUz] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');

  const list = categories.data ?? [];

  function startEdit(c: AdminCategory | null) {
    setEditing(c);
    setRu(c?.name.ru ?? '');
    setUz(c?.name.uz ?? '');
    setSlug(c?.slug ?? '');
    setParentId(c?.parentId ?? '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: { ru, uz: uz || ru },
      slug,
      ...(parentId ? { parentId } : {}),
    };
    try {
      await save.mutateAsync({ id: editing?.id, body });
      toast.success(editing ? 'Сохранено' : 'Категория создана');
      startEdit(null);
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить категорию?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Удалено');
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Категории</h1>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm font-semibold">
            {editing ? 'Редактирование' : 'Новая категория'}
          </div>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Название (RU) *">
              <Input required value={ru} onChange={(e) => setRu(e.target.value)} />
            </Field>
            <Field label="Название (UZ)">
              <Input value={uz} onChange={(e) => setUz(e.target.value)} />
            </Field>
            <Field label="Slug *">
              <Input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="brake-system"
              />
            </Field>
            <Field label="Родитель">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">— нет —</option>
                {list
                  .filter((c) => c.id !== editing?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.ru}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
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

      {categories.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <span className="font-medium">{c.name.ru}</span>
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    · {c.slug} · {c._count?.products ?? 0} товаров
                    {c.parentId ? ' · вложенная' : ''}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(c.id)}
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
