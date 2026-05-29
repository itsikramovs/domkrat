'use client';

import { Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useModerateProduct, useModerationProducts } from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

const TABS = ['PENDING_REVIEW', 'DRAFT', 'ACTIVE', 'REJECTED', ''];

export default function ProductModerationPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const products = useModerationProducts(status || undefined, search || undefined);
  const moderate = useModerateProduct();
  const list = products.data?.data ?? [];

  async function act(id: string, s: 'ACTIVE' | 'REJECTED') {
    try {
      await moderate.mutateAsync({ id, status: s });
      toast.success(s === 'ACTIVE' ? 'Опубликован' : 'Отклонён');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-white">Товары</h1>
        <Button asChild>
          <Link href="/catalog/products/new">
            <Plus className="h-4 w-4" /> Создать товар
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded border px-3 py-1 text-sm ${status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            {s || 'Все'}
          </button>
        ))}
        <Input
          placeholder="Поиск SKU/OEM"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto max-w-xs"
        />
      </div>

      {products.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">Товаров нет</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Link href={`/catalog/products/${p.id}`} className="group min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white group-hover:underline">
                      {p.name?.ru ?? p.sku}
                    </span>
                    <Badge
                      variant={
                        p.status === 'ACTIVE'
                          ? 'success'
                          : p.status === 'REJECTED'
                            ? 'destructive'
                            : 'warning'
                      }
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.sku} · {formatPrice(p.price)} · {p.merchant?.brandName ?? ''}
                  </div>
                </Link>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/catalog/products/${p.id}`}>
                      <Pencil className="h-3.5 w-3.5" /> Изменить
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
                  {p.status !== 'REJECTED' ? (
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
