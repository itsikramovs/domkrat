'use client';

import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
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
    return <div className="container py-12 text-center text-muted-foreground">Загрузка корзины…</div>;
  }

  if (data.items.length === 0) {
    return (
      <div className="container py-12 text-center space-y-4">
        <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Корзина пуста</h1>
        <p className="text-muted-foreground">Добавьте товары из каталога</p>
        <Button asChild>
          <Link href="/">В каталог</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Корзина</h1>
        {data.items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 flex gap-4">
              <div className="h-20 w-20 rounded bg-muted flex items-center justify-center text-2xl shrink-0">🔧</div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/p/${item.product.slug}`}
                  className="font-medium line-clamp-2 hover:text-primary"
                >
                  {pickLocale(item.product.name)}
                </Link>
                <div className="text-xs text-muted-foreground">Артикул: {item.product.sku}</div>
                <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                  <div className="inline-flex items-center rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={item.quantity <= 1 || update.isPending}
                      onClick={() => update.mutate({ id: item.id, quantity: item.quantity - 1 })}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {formatPrice(Number(item.product.price) * item.quantity)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(item.product.price)} × {item.quantity}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(item.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <aside className="space-y-3">
        <Card className="sticky top-20">
          <CardContent className="p-6 space-y-3">
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
