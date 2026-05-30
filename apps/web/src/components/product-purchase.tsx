'use client';

import { Check, ChevronDown, Store } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddToCartButton } from '@/components/add-to-cart-button';
import { Badge } from '@/components/ui/badge';
import type { ProductOffer, ProductVariant } from '@/lib/types';
import { useLocaleText } from '@/lib/use-locale-text';
import { formatPrice } from '@/lib/utils';

interface Props {
  productId: string;
  fallbackPrice: string;
  fallbackCompareAt: string | null;
  variants: ProductVariant[];
  offers: ProductOffer[];
}

function discountPct(price: string, compareAt: string | null): number | null {
  if (!compareAt) return null;
  const p = Number(price);
  const c = Number(compareAt);
  if (c <= p) return null;
  return Math.round(((c - p) / c) * 100);
}

/**
 * Блок покупки на карточке товара (маркетплейс): селектор варианта (если вариативный),
 * цена выбранного предложения, продавец + наличие, список «других продавцов» (buy-box),
 * добавление в корзину по offerId. Рендерит и мобильную sticky-панель снизу.
 */
export function ProductPurchase({
  productId,
  fallbackPrice,
  fallbackCompareAt,
  variants,
  offers,
}: Props) {
  const t = useLocaleText();

  // показываем только варианты, у которых есть активные предложения
  const sellableIds = useMemo(() => new Set(offers.map((o) => o.variantId)), [offers]);
  const variantList = useMemo(
    () => variants.filter((v) => sellableIds.has(v.id)),
    [variants, sellableIds],
  );
  const isVariative = variantList.length > 1;

  const defaultVariantId = (variantList.find((v) => v.isDefault) ?? variantList[0])?.id ?? '';
  const [variantId, setVariantId] = useState(defaultVariantId);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [showSellers, setShowSellers] = useState(false);

  const variantOffers = useMemo(
    () =>
      offers
        .filter((o) => o.variantId === (variantId || defaultVariantId))
        .sort((a, b) => Number(a.price) - Number(b.price)),
    [offers, variantId, defaultVariantId],
  );

  // основное предложение: сначала с остатком, затем самое дешёвое
  const primary = variantOffers.find((o) => o.stock > 0) ?? variantOffers[0] ?? null;
  const selected = variantOffers.find((o) => o.id === offerId) ?? primary;

  function pickVariant(id: string) {
    setVariantId(id);
    setOfferId(null);
    setShowSellers(false);
  }

  const price = selected?.price ?? fallbackPrice;
  const compareAt = selected?.compareAtPrice ?? fallbackCompareAt;
  const pct = discountPct(price, compareAt);
  const inStock = (selected?.stock ?? 0) > 0;
  const noOffer = !selected;

  const pillCls = (active: boolean) =>
    `rounded-xl border px-3 py-1.5 text-sm transition-colors ${
      active
        ? 'border-primary bg-primary/10 font-medium text-foreground'
        : 'border-border text-muted-foreground hover:border-foreground/30'
    }`;

  return (
    <>
      <div className="space-y-3">
        {/* Селектор варианта */}
        {isVariative ? (
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Вариант</span>
            <div className="flex flex-wrap gap-2">
              {variantList.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickVariant(v.id)}
                  className={pillCls(v.id === (variantId || defaultVariantId))}
                >
                  {v.name ? t(v.name) : 'Базовый'}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Цена */}
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-bold tabular-nums text-foreground md:text-4xl">
            {formatPrice(price)}
          </div>
          {compareAt ? (
            <div className="text-base text-muted-foreground line-through tabular-nums">
              {formatPrice(compareAt)}
            </div>
          ) : null}
          {pct ? (
            <span className="inline-flex items-center rounded-md bg-sale px-2 py-0.5 text-xs font-bold text-sale-foreground">
              −{pct}%
            </span>
          ) : null}
        </div>

        {/* Продавец + наличие */}
        {selected ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Продавец:</span>
            <span className="font-medium text-foreground">{selected.merchant.brandName}</span>
            <Badge variant={inStock ? 'success' : 'secondary'}>
              {inStock ? 'В наличии' : 'Под заказ'}
            </Badge>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Нет активных предложений</div>
        )}

        {/* Другие продавцы (buy-box) */}
        {variantOffers.length > 1 ? (
          <div className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setShowSellers((s) => !s)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <span className="font-medium text-foreground">
                Предложений: {variantOffers.length} · от{' '}
                {formatPrice(variantOffers[0]?.price ?? price)}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${showSellers ? 'rotate-180' : ''}`}
              />
            </button>
            {showSellers ? (
              <div className="space-y-1 border-t border-border p-2">
                {variantOffers.map((o) => {
                  const active = o.id === selected?.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOfferId(o.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? 'bg-primary/10' : 'hover:bg-secondary'
                      }`}
                    >
                      <span className="truncate text-foreground">{o.merchant.brandName}</span>
                      <Badge variant={o.stock > 0 ? 'success' : 'secondary'} className="shrink-0">
                        {o.stock > 0 ? 'в наличии' : 'под заказ'}
                      </Badge>
                      <span className="ml-auto font-semibold tabular-nums text-foreground">
                        {formatPrice(o.price)}
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Кнопка (desktop) */}
        <div className="hidden md:block">
          <AddToCartButton productId={productId} offerId={selected?.id} disabled={noOffer} />
        </div>
      </div>

      {/* Sticky bottom bar для мобильного */}
      <div
        className="fixed inset-x-0 bottom-16 z-40 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">К оплате</span>
          <span className="text-lg font-bold tabular-nums">{formatPrice(price)}</span>
        </div>
        <div className="flex-1">
          <AddToCartButton
            productId={productId}
            offerId={selected?.id}
            compact
            disabled={noOffer}
          />
        </div>
      </div>
    </>
  );
}
