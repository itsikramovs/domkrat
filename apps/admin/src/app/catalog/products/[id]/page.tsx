'use client';

import { ArrowLeft, PackageCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { AdminProductForm } from '@/components/admin-product-form';
import { OffersManager } from '@/components/offers-manager';
import { ProductImages } from '@/components/product-images';
import { VariantsManager } from '@/components/variants-manager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiHttpError } from '@/lib/api-client';
import { useModerateProduct } from '@/lib/api/management';
import { useAdminProduct, useUpdateAdminProduct } from '@/lib/api/products';

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

export default function AdminProductDetailPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const id = useParams<{ id: string }>().id;
  const product = useAdminProduct(id);
  const update = useUpdateAdminProduct(id);
  const moderate = useModerateProduct();

  if (product.isLoading || !product.data) {
    return <div className="container py-8 text-muted-foreground">Загрузка…</div>;
  }
  const p = product.data;
  const st = STATUS[p.status] ?? { label: p.status, variant: 'secondary' as const };
  const needsModeration = p.status === 'DRAFT' || p.status === 'PENDING_REVIEW';

  async function setStatus(status: 'ACTIVE' | 'REJECTED') {
    try {
      await moderate.mutateAsync({ id, status });
      toast.success(status === 'ACTIVE' ? 'Опубликовано' : 'Отклонено');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container space-y-5 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/catalog/products" aria-label="Назад">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{p.name.ru}</h1>
          <p className="text-xs text-muted-foreground">
            {p.sellerCount} продав. · {p.offersCount} предлож.
            {p.minPrice ? ` · от ${formatPriceShort(p.minPrice)}` : ''}
          </p>
        </div>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>

      {needsModeration ? (
        <Card className="border-amber-400/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-amber-200">
            <PackageCheck className="h-5 w-5" />
            <span className="flex-1">
              Карточка на модерации. Опубликуйте её, чтобы товар стал доступен в каталоге (продаётся
              при наличии остатка по предложению).
            </span>
            <Button size="sm" onClick={() => setStatus('ACTIVE')} disabled={moderate.isPending}>
              Опубликовать
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus('REJECTED')}
              disabled={moderate.isPending}
            >
              Отклонить
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-5">
        <ProductImages productId={p.id} images={p.images} />
        <AdminProductForm
          initial={p}
          busy={update.isPending}
          submitLabel="Сохранить контент"
          onSubmit={async (body) => {
            try {
              await update.mutateAsync(body);
              toast.success('Сохранено');
            } catch (e) {
              const msg = e instanceof ApiHttpError ? e.body.message : 'Ошибка';
              toast.error(Array.isArray(msg) ? msg.join('; ') : String(msg));
            }
          }}
        />
        <VariantsManager productId={id} variants={p.variants} />
        <OffersManager productId={id} variants={p.variants} offers={p.offers} />
      </div>
    </div>
  );
}

function formatPriceShort(v: string): string {
  return new Intl.NumberFormat('ru-RU').format(Number(v)) + ' сум';
}
