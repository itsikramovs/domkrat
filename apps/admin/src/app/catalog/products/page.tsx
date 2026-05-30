'use client';

import { ChevronLeft, ChevronRight, Pencil, Plus, ImageOff } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useAdminCategories,
  useModerateProduct,
  useModerationProducts,
  type AdminCategory,
} from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

const STATUS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }
> = {
  ACTIVE: { label: 'В продаже', variant: 'success' },
  DRAFT: { label: 'Черновик', variant: 'warning' },
  PENDING_REVIEW: { label: 'На модерации', variant: 'warning' },
  INACTIVE: { label: 'Скрыт', variant: 'secondary' },
  REJECTED: { label: 'Отклонён', variant: 'destructive' },
  OUT_OF_STOCK: { label: 'Нет в наличии', variant: 'secondary' },
};

const TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Все' },
  { value: 'ACTIVE', label: 'В продаже' },
  { value: 'PENDING_REVIEW', label: 'На модерации' },
  { value: 'DRAFT', label: 'Черновики' },
  { value: 'INACTIVE', label: 'Скрытые' },
  { value: 'REJECTED', label: 'Отклонённые' },
];

const selectCls = 'h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground';

export default function ProductsAdminPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);

  const cats = useAdminCategories();
  const products = useModerationProducts({
    status: status || undefined,
    search: search || undefined,
    categoryId: categoryId || undefined,
    page,
  });
  const moderate = useModerateProduct();

  const list = products.data?.data ?? [];
  const meta = products.data?.meta;
  const catOptions = orderCats(cats.data ?? []);

  function resetTo(patch: () => void) {
    patch();
    setPage(1);
  }

  async function act(id: string, s: 'ACTIVE' | 'REJECTED') {
    try {
      await moderate.mutateAsync({ id, status: s });
      toast.success(s === 'ACTIVE' ? 'Опубликован' : 'Отклонён');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container space-y-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Управление товарами</h1>
          <p className="text-sm text-muted-foreground">
            Карточки маркетплейса: контент, варианты, предложения продавцов и остаток.
          </p>
        </div>
        <Button asChild>
          <Link href="/catalog/products/new">
            <Plus className="h-4 w-4" /> Добавить товар
          </Link>
        </Button>
      </div>

      {/* фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value || 'all'}
              type="button"
              onClick={() => resetTo(() => setStatus(t.value))}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                status === t.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input text-muted-foreground hover:bg-accent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          className={`${selectCls} ml-auto`}
          value={categoryId}
          onChange={(e) => resetTo(() => setCategoryId(e.target.value))}
        >
          <option value="">Все категории</option>
          {catOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {'— '.repeat(c.depth)}
              {c.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Поиск: название / SKU / OEM"
          value={search}
          onChange={(e) => resetTo(() => setSearch(e.target.value))}
          className="max-w-xs"
        />
      </div>

      {products.isLoading && !products.data ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Товаров не найдено. Измените фильтры или{' '}
            <Link href="/catalog/products/new" className="text-primary hover:underline">
              добавьте товар
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="border-b border-border bg-card/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Товар</th>
                  <th className="px-4 py-3 text-left font-medium">Категория</th>
                  <th className="px-4 py-3 text-left font-medium">Продавцы</th>
                  <th className="px-4 py-3 text-right font-medium">Цена</th>
                  <th className="px-4 py-3 text-right font-medium">Остаток</th>
                  <th className="px-4 py-3 text-left font-medium">Статус</th>
                  <th className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const st = STATUS[p.status] ?? { label: p.status, variant: 'secondary' as const };
                  const img = p.images?.[0]?.thumbnailUrl ?? p.images?.[0]?.url ?? null;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/catalog/products/${p.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/50">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ImageOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground group-hover:underline">
                              {p.name?.ru ?? '—'}
                            </span>
                            {p.sku ? (
                              <span className="block truncate font-mono text-xs text-muted-foreground">
                                {p.sku}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.category?.name?.ru ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.sellerCount} прод. · {p.offersCount} предл.
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {p.minPrice ? `от ${formatPrice(p.minPrice)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={p.totalStock ? 'text-foreground' : 'text-muted-foreground'}
                        >
                          {p.totalStock ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/catalog/products/${p.id}`}>
                              <Pencil className="h-3.5 w-3.5" /> Открыть
                            </Link>
                          </Button>
                          {p.status !== 'ACTIVE' ? (
                            <Button
                              size="sm"
                              onClick={() => act(p.id, 'ACTIVE')}
                              disabled={moderate.isPending}
                            >
                              Опубликовать
                            </Button>
                          ) : null}
                          {p.status !== 'REJECTED' && p.status !== 'ACTIVE' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => act(p.id, 'REJECTED')}
                              disabled={moderate.isPending}
                            >
                              Отклонить
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* пагинация */}
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Всего: {meta.total} · стр. {meta.page} из {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Назад
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Плоский список категорий → упорядоченный с отступами по дереву. */
function orderCats(cats: AdminCategory[]): Array<{ id: string; name: string; depth: number }> {
  const byParent = new Map<string | null, AdminCategory[]>();
  for (const c of cats) {
    const k = c.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.position - b.position);
  const out: Array<{ id: string; name: string; depth: number }> = [];
  const walk = (pid: string | null, depth: number) => {
    for (const c of byParent.get(pid) ?? []) {
      out.push({ id: c.id, name: c.name.ru, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  if (out.length < cats.length) {
    const seen = new Set(out.map((o) => o.id));
    for (const c of cats) if (!seen.has(c.id)) out.push({ id: c.id, name: c.name.ru, depth: 0 });
  }
  return out;
}
