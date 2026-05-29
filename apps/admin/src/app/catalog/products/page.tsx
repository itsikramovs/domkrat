'use client';

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

const TABS = ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', ''];

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
      <h1 className="text-3xl font-bold tracking-tight">Модерация товаров</h1>

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
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name?.ru ?? p.sku}</span>
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
                </div>
                {p.status !== 'ACTIVE' || status !== 'ACTIVE' ? (
                  <div className="flex gap-2">
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
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
