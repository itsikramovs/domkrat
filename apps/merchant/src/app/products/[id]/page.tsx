'use client';

import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { CompatibilityManager } from '@/components/compatibility-manager';
import { ImagesManager } from '@/components/images-manager';
import { ProductForm } from '@/components/product-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useDeleteProduct,
  useMerchantProduct,
  useUpdateProduct,
  useUpdateProductStatus,
  type ProductStatus,
} from '@/lib/api/products';
import { ApiHttpError } from '@/lib/api-client';
import { pickLocale } from '@/lib/utils';

const STATUS_LABELS: Record<
  ProductStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }
> = {
  DRAFT: { label: 'Черновик', variant: 'outline' },
  PENDING_REVIEW: { label: 'На модерации', variant: 'warning' },
  ACTIVE: { label: 'Активен', variant: 'success' },
  INACTIVE: { label: 'Скрыт', variant: 'secondary' },
  REJECTED: { label: 'Отклонён', variant: 'destructive' },
  OUT_OF_STOCK: { label: 'Нет в наличии', variant: 'secondary' },
};

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id ?? '';
  const product = useMerchantProduct(id || null);
  const update = useUpdateProduct(id);
  const updateStatus = useUpdateProductStatus(id);
  const remove = useDeleteProduct();

  if (product.isLoading || !product.data) {
    return <div className="container py-12 text-center text-sm text-muted-foreground">Загрузка…</div>;
  }
  const p = product.data;
  const s = STATUS_LABELS[p.status as ProductStatus] ?? { label: p.status, variant: 'outline' as const };

  const setStatus = async (next: ProductStatus) => {
    try {
      await updateStatus.mutateAsync(next);
      toast.success(`Статус: ${STATUS_LABELS[next]?.label ?? next}`);
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  const onDelete = async () => {
    if (!confirm(`Удалить «${pickLocale(p.name)}»?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Удалено');
      router.push('/products');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  return (
    <div className="container py-8 space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/products" aria-label="Назад">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold line-clamp-1">{pickLocale(p.name)}</h1>
            <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
          </div>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.status !== 'ACTIVE' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus('ACTIVE')}
              disabled={updateStatus.isPending}
            >
              Опубликовать
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus('INACTIVE')}
              disabled={updateStatus.isPending}
            >
              Скрыть
            </Button>
          )}
          {p.status !== 'DRAFT' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatus('DRAFT')}
              disabled={updateStatus.isPending}
            >
              В черновик
            </Button>
          ) : null}
          {p.status === 'ACTIVE' ? (
            <Button asChild variant="ghost" size="sm">
              <a href={`http://192.168.1.8:3000/p/${p.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" />
                Открыть
              </a>
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={onDelete} disabled={remove.isPending} aria-label="Удалить">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 text-xs text-muted-foreground md:grid-cols-3">
          <div>
            <div>Просмотров</div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              {(p as { viewCount?: number }).viewCount ?? 0}
            </div>
          </div>
          <div>
            <div>Покупок</div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              {(p as { purchaseCount?: number }).purchaseCount ?? 0}
            </div>
          </div>
          <div>
            <div>Рейтинг · отзывы</div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              {Number(p.rating || 0).toFixed(1)} · {p.reviewsCount}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProductForm
        initial={p}
        busy={update.isPending}
        submitLabel="Сохранить изменения"
        onSubmit={async (input) => {
          try {
            await update.mutateAsync(input);
            toast.success('Сохранено');
          } catch (error) {
            toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
          }
        }}
      />

      <ImagesManager productId={id} />

      <CompatibilityManager productId={id} />
    </div>
  );
}
