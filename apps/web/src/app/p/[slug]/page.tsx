import { ChevronRight, ShieldCheck, Star, Truck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductPurchase } from '@/components/product-purchase';
import { ReviewsSection } from '@/components/reviews-section';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fetchProductReviews } from '@/lib/api/reviews-server';
import { serverApi } from '@/lib/api-client';
import type { Product, ProductOffer, ProductVariant } from '@/lib/types';
import { pickLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type MLText = { ru: string; uz: string };

interface ProductAttr {
  valueString: string | null;
  valueNumber: string | null;
  valueBoolean: boolean | null;
  valueEnum: string | null;
  valueMultiEnum: string[];
  attribute: {
    name: MLText;
    unit: string | null;
    dataType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM';
    enumValues: Array<{ value: string; label: MLText }> | null;
  };
}

/** Форматирует значение характеристики для отображения с учётом типа и локали. */
function formatAttrValue(a: ProductAttr): string | null {
  const attr = a.attribute;
  const enumLabel = (code: string) => {
    const opt = (attr.enumValues ?? []).find((o) => o.value === code);
    return opt ? pickLocale(opt.label) : code;
  };
  switch (attr.dataType) {
    case 'BOOLEAN':
      return a.valueBoolean == null ? null : a.valueBoolean ? 'Да' : 'Нет';
    case 'NUMBER':
      return a.valueNumber == null ? null : `${a.valueNumber}${attr.unit ? ` ${attr.unit}` : ''}`;
    case 'ENUM':
      return a.valueEnum ? enumLabel(a.valueEnum) : null;
    case 'MULTI_ENUM':
      return a.valueMultiEnum.length ? a.valueMultiEnum.map(enumLabel).join(', ') : null;
    default:
      return a.valueString || null;
  }
}

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

function discountPct(price: string, compareAt: string | null): number | null {
  if (!compareAt) return null;
  const p = Number(price);
  const c = Number(compareAt);
  if (c <= p) return null;
  return Math.round(((c - p) / c) * 100);
}

export default async function ProductPage({ params }: PageProps) {
  const [product, reviews] = await Promise.all([
    serverApi()<
      Product & {
        variants?: ProductVariant[];
        offers?: ProductOffer[];
        attributes?: ProductAttr[];
        oemCodes?: Array<{ oemNumber: string; manufacturer: string | null; isPrimary: boolean }>;
        compatibilities?: Array<{
          carMake?: { name: string } | null;
          carModel?: { name: string; make: { name: string } } | null;
          carModification?: {
            name: string;
            generation: { name: string; model: { name: string; make: { name: string } } };
          } | null;
          yearFrom?: number | null;
          yearTo?: number | null;
        }>;
      }
    >(`/products/${params.slug}`).catch(() => null),
    fetchProductReviews(params.slug),
  ]);

  if (!product) notFound();

  const pct = discountPct(product.price, product.compareAtPrice);
  const rating = Number(product.rating) || 0;

  return (
    <div className="space-y-5 pb-32 md:container md:pb-8 md:py-8">
      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1 px-4 pt-4 text-xs text-muted-foreground md:px-0">
        <Link href="/" className="hover:text-foreground">
          Главная
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/c/${product.category.slug}`} className="hover:text-foreground">
          {pickLocale(product.category.name)}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="line-clamp-1 text-foreground">{pickLocale(product.name)}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        {/* Картинка */}
        <div className="relative">
          <div className="aspect-square w-full overflow-hidden md:rounded-3xl bg-secondary">
            {product.images?.[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.images[0].url}
                alt={pickLocale(product.name)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-8xl text-muted-foreground/40">
                🔧
              </div>
            )}
          </div>
          {pct ? (
            <span className="absolute left-3 top-3 inline-flex items-center rounded-md bg-sale px-2 py-1 text-xs font-bold text-sale-foreground">
              −{pct}%
            </span>
          ) : null}
        </div>

        {/* Информация */}
        <div className="space-y-4 px-4 md:px-0">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {product.brand ? <Badge variant="outline">{product.brand.name}</Badge> : null}
              {product.oemNumber ? (
                <Badge variant="outline" className="font-mono">
                  OEM: {product.oemNumber}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-xl font-bold leading-tight md:text-2xl">
              {pickLocale(product.name)}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {product.reviewsCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
                  <span>· {product.reviewsCount} отзывов</span>
                </span>
              ) : null}
              <span>Артикул: {product.sku}</span>
            </div>
          </div>

          {/* Покупка: вариант + цена + продавцы (buy-box) + в корзину */}
          <ProductPurchase
            productId={product.id}
            fallbackPrice={product.price}
            fallbackCompareAt={product.compareAtPrice}
            variants={product.variants ?? []}
            offers={product.offers ?? []}
          />

          {/* Доверие */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
              <Truck className="h-4 w-4 text-primary" />
              <span>Доставка по Узбекистану</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Гарантия качества</span>
            </div>
          </div>

          {product.description ? (
            <div className="prose max-w-none pt-2">
              <h3 className="mb-2 text-base font-semibold">Описание</h3>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {pickLocale(product.description)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {(() => {
        const specs = (product.attributes ?? [])
          .map((a) => ({ name: pickLocale(a.attribute.name), value: formatAttrValue(a) }))
          .filter((s): s is { name: string; value: string } => Boolean(s.value));
        if (specs.length === 0) return null;
        return (
          <Card className="mx-4 md:mx-0">
            <CardContent className="space-y-3 p-5">
              <h3 className="text-sm font-semibold">Характеристики</h3>
              <dl className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
                {specs.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/60 py-2 text-sm"
                  >
                    <dt className="text-muted-foreground">{s.name}</dt>
                    <dd className="text-right font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })()}

      {product.oemCodes && product.oemCodes.length > 0 ? (
        <Card className="mx-4 md:mx-0">
          <CardContent className="space-y-2 p-5">
            <h3 className="text-sm font-semibold">OEM-номера и аналоги</h3>
            <div className="flex flex-wrap gap-1.5">
              {product.oemCodes.map((o) => (
                <Badge
                  key={o.oemNumber}
                  variant={o.isPrimary ? 'default' : 'outline'}
                  className="font-mono"
                >
                  {o.manufacturer ? `${o.manufacturer} ` : ''}
                  {o.oemNumber}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {product.compatibilities && product.compatibilities.length > 0 ? (
        <Card className="mx-4 md:mx-0">
          <CardContent className="space-y-2 p-5">
            <h3 className="text-sm font-semibold">Совместимость</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {product.compatibilities.map((c, idx) => {
                const label = c.carModification
                  ? `${c.carModification.generation.model.make.name} ${c.carModification.generation.model.name} ${c.carModification.generation.name} ${c.carModification.name}`
                  : c.carModel
                    ? `${c.carModel.make.name} ${c.carModel.name}`
                    : (c.carMake?.name ?? '');
                const years =
                  c.yearFrom || c.yearTo ? ` (${c.yearFrom ?? '?'}—${c.yearTo ?? 'наст.'})` : '';
                return (
                  <li key={idx}>
                    • {label}
                    {years}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="px-4 md:px-0">
        <ReviewsSection
          productId={product.id}
          productRating={product.rating}
          reviewsCount={product.reviewsCount}
          initialReviews={reviews}
        />
      </div>
    </div>
  );
}
