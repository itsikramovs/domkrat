'use client';

import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCart, useRemoveCartItem, useUpdateCartItem } from '@/lib/api/cart';
import { useAuthStore } from '@/lib/auth-store';
import { formatPrice, pickLocale } from '@/lib/utils';

export default function CartPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  useEffect(() => {
    if (accessToken === null) {
      const t = setTimeout(() => router.push('/login?next=/cart'), 0);
      return () => clearTimeout(t);
    }
  }, [accessToken, router]);

  if (!accessToken) return null;

  if (isLoading || !data) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Загрузка корзины…</div>;
  }

  if (data.items.length === 0) {
    return (
      <div className="space-y-4 px-4 py-12 text-center md:container">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <ShoppingBag className="h-9 w-9 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold md:text-2xl">Корзина пуста</h1>
        <p className="text-sm text-muted-foreground">Добавьте товары из каталога</p>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/">Перейти в каталог</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32 md:container md:pb-8 md:py-8 md:grid md:gap-6 md:space-y-0 md:[grid-template-columns:1fr_360px]">
      <div className="space-y-3 px-4 md:px-0">
        <h1 className="text-xl font-bold md:text-3xl">Корзина · {data.items.length}</h1>
        {data.items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="flex gap-3 p-3 md:gap-4 md:p-4">
              <Link
                href={`/p/${item.product.slug}`}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl md:h-24 md:w-24"
              >
                🔧
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/p/${item.product.slug}`}
                  className="line-clamp-2 text-sm font-medium hover:text-primary"
                >
                  {pickLocale(item.product.name)}
                </Link>
                <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                  {item.product.sku}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-full bg-secondary">
                    <button
                      type="button"
                      disabled={item.quantity <= 1 || update.isPending}
                      onClick={() => update.mutate({ id: item.id, quantity: item.quantity - 1 })}
                      className="flex h-8 w-8 items-center justify-center text-foreground disabled:opacity-40"
                      aria-label="Уменьшить"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })}
                      className="flex h-8 w-8 items-center justify-center disabled:opacity-40"
                      aria-label="Увеличить"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {formatPrice(Number(item.product.price) * item.quantity)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {formatPrice(item.product.price)} × {item.quantity}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove.mutate(item.id)}
                    disabled={remove.isPending}
                    className="flex h-8 w-8 items-center justify-center text-destructive disabled:opacity-40"
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop sticky summary */}
      <aside className="hidden md:block">
        <Card className="sticky top-20">
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">Итого</h2>
            <Row label="Товары" value={formatPrice(data.pricing.subtotal)} />
            <Row label="НДС (включён)" value={formatPrice(data.pricing.vatAmount)} muted />
            <Row label="Скидка" value={`-${formatPrice(data.pricing.discount)}`} muted />
            <div className="border-t pt-3">
              <Row label="К оплате" value={formatPrice(data.pricing.total)} large />
              <p className="mt-1 text-xs text-muted-foreground">
                + стоимость доставки рассчитывается на checkout
              </p>
            </div>
            <Button asChild size="lg" className="w-full">
              <Link href="/checkout">Оформить заказ</Link>
            </Button>
          </CardContent>
        </Card>
      </aside>

      {/* Mobile sticky checkout bar */}
      <div
        className="fixed inset-x-0 bottom-16 z-40 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">К оплате</span>
          <span className="text-lg font-bold tabular-nums">{formatPrice(data.pricing.total)}</span>
        </div>
        <Link
          href="/checkout"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          Оформить заказ
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  large,
}: {
  label: string;
  value: string;
  muted?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`flex justify-between ${large ? 'text-lg font-bold' : 'text-sm'}`}>
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={muted ? 'text-muted-foreground' : ''}>{value}</span>
    </div>
  );
}
