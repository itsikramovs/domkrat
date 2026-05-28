import { Heart, Sparkles, Star, Zap } from 'lucide-react';
import Link from 'next/link';

import { AddToCartButton } from '@/components/add-to-cart-button';
import type { Product } from '@/lib/types';
import { formatPrice, pickLocale } from '@/lib/utils';

function discountPct(price: string, compareAt: string | null): number | null {
  if (!compareAt) return null;
  const p = Number(price);
  const c = Number(compareAt);
  if (c <= p) return null;
  return Math.round(((c - p) / c) * 100);
}

export function ProductCard({ product, className = '' }: { product: Product; className?: string }) {
  const pct = discountPct(product.price, product.compareAtPrice);
  const isHit = product.isFeatured;
  const isOriginal = product.oemNumber != null;
  const rating = Number(product.rating) || 0;

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md ${className}`}
    >
      <Link href={`/p/${product.slug}`} className="relative block">
        {/* Бейджи */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {pct ? (
            <span className="inline-flex items-center rounded-md bg-sale px-1.5 py-0.5 text-[11px] font-bold text-sale-foreground">
              −{pct}%
            </span>
          ) : null}
          {isHit ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-hit px-1.5 py-0.5 text-[11px] font-bold text-hit-foreground">
              <Zap className="h-3 w-3" /> Хит
            </span>
          ) : null}
          {isOriginal ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-warning px-1.5 py-0.5 text-[11px] font-bold text-warning-foreground">
              <Sparkles className="h-3 w-3" /> Оригинал
            </span>
          ) : null}
        </div>
        {/* Сердечко */}
        <button
          type="button"
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground hover:text-sale"
          aria-label="В избранное"
        >
          <Heart className="h-4 w-4" />
        </button>

        {/* Картинка / плейсхолдер */}
        <div className="aspect-square w-full bg-secondary">
          {product.images?.[0]?.thumbnailUrl || product.images?.[0]?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]!.thumbnailUrl ?? product.images[0]!.url}
              alt={pickLocale(product.name)}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl text-muted-foreground/40">
              🔧
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`/p/${product.slug}`} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tabular-nums md:text-base">{formatPrice(product.price)}</span>
            {product.compareAtPrice ? (
              <>
                <span className="text-xs text-muted-foreground line-through tabular-nums">
                  {formatPrice(product.compareAtPrice)}
                </span>
                {pct ? (
                  <span className="text-xs font-semibold text-sale">−{pct}%</span>
                ) : null}
              </>
            ) : null}
          </div>
          <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-tight text-foreground/90 md:text-sm">
            {pickLocale(product.name)}
          </p>
          {product.reviewsCount > 0 ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
              <span>· {product.reviewsCount} отзывов</span>
            </div>
          ) : null}
        </Link>
        <AddToCartButton productId={product.id} compact />
      </div>
    </article>
  );
}
