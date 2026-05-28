import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AddToCartButton } from '@/components/add-to-cart-button';
import { ReviewsSection } from '@/components/reviews-section';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fetchProductReviews } from '@/lib/api/reviews-server';
import { serverApi } from '@/lib/api-client';
import type { Product } from '@/lib/types';
import { formatPrice, pickLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  try {
    const product = await serverApi()<Product>(`/products/${params.slug}`);
    return { title: pickLocale(product.name) };
  } catch {
    return { title: 'Товар' };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const [product, reviews] = await Promise.all([
    serverApi()<Product & {
      attributes?: Array<{ valueString: string | null; attribute: { name: { ru: string }; unit?: string | null } }>;
      oemCodes?: Array<{ oemNumber: string; manufacturer: string | null; isPrimary: boolean }>;
      compatibilities?: Array<{
        carMake?: { name: string } | null;
        carModel?: { name: string; make: { name: string } } | null;
        carModification?: { name: string; generation: { name: string; model: { name: string; make: { name: string } } } } | null;
        yearFrom?: number | null;
        yearTo?: number | null;
      }>;
    }>(`/products/${params.slug}`).catch(() => null),
    fetchProductReviews(params.slug),
  ]);

  if (!product) notFound();

  return (
    <div className="container py-8 space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Главная</Link> /{' '}
        <Link href={`/c/${product.category.slug}`} className="hover:underline">
          {pickLocale(product.category.name)}
        </Link>{' '}
        / <span className="text-foreground">{pickLocale(product.name)}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square bg-muted rounded-2xl flex items-center justify-center text-9xl">
          🔧
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-sm">
              {product.brand ? <Badge variant="outline">{product.brand.name}</Badge> : null}
              <Badge variant="secondary">{product.merchant.brandName}</Badge>
              {product.oemNumber ? (
                <Badge variant="outline" className="font-mono">OEM: {product.oemNumber}</Badge>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold">{pickLocale(product.name)}</h1>
            <p className="text-sm text-muted-foreground">Артикул: {product.sku}</p>
          </div>

          <div className="text-4xl font-bold text-primary">{formatPrice(product.price)}</div>

          <AddToCartButton productId={product.id} />

          {product.description ? (
            <div className="pt-4 prose max-w-none">
              <h3 className="text-lg font-semibold mb-2">Описание</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {pickLocale(product.description)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {product.oemCodes && product.oemCodes.length > 0 ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            <h3 className="font-semibold">OEM-номера и аналоги</h3>
            <div className="flex flex-wrap gap-2">
              {product.oemCodes.map((o) => (
                <Badge key={o.oemNumber} variant={o.isPrimary ? 'default' : 'outline'} className="font-mono">
                  {o.manufacturer ? `${o.manufacturer} ` : ''}
                  {o.oemNumber}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {product.compatibilities && product.compatibilities.length > 0 ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold">Совместимость</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {product.compatibilities.map((c, idx) => {
                const label = c.carModification
                  ? `${c.carModification.generation.model.make.name} ${c.carModification.generation.model.name} ${c.carModification.generation.name} ${c.carModification.name}`
                  : c.carModel
                  ? `${c.carModel.make.name} ${c.carModel.name}`
                  : c.carMake?.name ?? '';
                const years = c.yearFrom || c.yearTo ? ` (${c.yearFrom ?? '?'}—${c.yearTo ?? 'наст.'})` : '';
                return <li key={idx}>• {label}{years}</li>;
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ReviewsSection
        productId={product.id}
        productRating={product.rating}
        reviewsCount={product.reviewsCount}
        initialReviews={reviews}
      />
    </div>
  );
}
