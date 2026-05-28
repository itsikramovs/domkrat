'use client';

import { Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDeleteProduct, useMyProducts, type ProductStatus } from '@/lib/api/products';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice, pickLocale } from '@/lib/utils';

const STATUS_LABELS: Record<ProductStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Черновик', variant: 'outline' },
  PENDING_REVIEW: { label: 'На модерации', variant: 'warning' },
  ACTIVE: { label: 'Активен', variant: 'success' },
  INACTIVE: { label: 'Скрыт', variant: 'secondary' },
  REJECTED: { label: 'Отклонён', variant: 'destructive' },
  OUT_OF_STOCK: { label: 'Нет в наличии', variant: 'secondary' },
};

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const products = useMyProducts({ search: search || undefined, perPage: 30 });
  const remove = useDeleteProduct();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(pendingSearch.trim());
  };

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить «${name}»?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Товар удалён');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Не удалось удалить');
    }
  };

  return (
    <div className="container py-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Мои товары</h1>
          <p className="text-sm text-muted-foreground">
            {products.data ? `Всего: ${products.data.meta.total}` : '…'}
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Добавить товар
          </Link>
        </Button>
      </div>

      <form onSubmit={submit} className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по SKU, OEM или артикулу"
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">Найти</Button>
      </form>

      {products.isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Загрузка…</div>
      ) : products.data?.data.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <p className="text-muted-foreground">Пока нет товаров</p>
            <Button asChild>
              <Link href="/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Создать первый
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Товар</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Цена</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Статус</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.data?.data.map((p) => {
                    const s = STATUS_LABELS[p.status as ProductStatus] ?? { label: p.status, variant: 'outline' as const };
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link href={`/products/${p.id}`} className="hover:text-primary">
                            <div className="font-medium line-clamp-1">{pickLocale(p.name)}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.brand?.name ?? '—'} · {pickLocale(p.category.name)}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <div className="font-semibold">{formatPrice(p.price)}</div>
                          {p.compareAtPrice ? (
                            <div className="text-xs text-muted-foreground line-through">
                              {formatPrice(p.compareAtPrice)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(p.id, pickLocale(p.name))}
                            disabled={remove.isPending}
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
