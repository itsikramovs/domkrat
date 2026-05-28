import Link from 'next/link';

import { serverApi } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPrice, pickLocale } from '@/lib/utils';
import type { Category, Paginated, Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const api = serverApi();
  const [categories, products] = await Promise.all([
    api<Category[]>('/categories').catch(() => []),
    api<Paginated<Product>>('/products?perPage=8&sort=popular').catch(
      () => ({ data: [], meta: { page: 1, perPage: 8, total: 0, totalPages: 0 } }),
    ),
  ]);

  return (
    <div className="container py-8 space-y-12">
      <section className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 md:p-12">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Автозапчасти для Узбекистана
          </h1>
          <p className="text-muted-foreground text-lg">
            Тысячи товаров от проверенных мерчантов. Подбор по марке авто, по VIN или OEM-номеру.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/c/tires-and-wheels">Перейти в каталог</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/search">Поиск по OEM</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Категории</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {categories.slice(0, 10).map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`}>
              <Card className="hover:border-primary transition-colors h-full">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="text-lg">📦</div>
                  <div className="font-medium text-sm">{pickLocale(c.name)}</div>
                  {c.children && c.children.length > 0 ? (
                    <div className="text-xs text-muted-foreground">{c.children.length} подкатегорий</div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Популярные товары</h2>
          <Button asChild variant="link">
            <Link href="/c/consumables">Все товары →</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.data.map((p) => (
            <Link key={p.id} href={`/p/${p.slug}`}>
              <Card className="h-full hover:border-primary transition-colors">
                <CardContent className="p-4 flex flex-col gap-2 h-full">
                  <div className="aspect-square bg-muted rounded-md flex items-center justify-center text-3xl">
                    🔧
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.brand?.name ?? ''} · {p.merchant.brandName}
                  </div>
                  <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{pickLocale(p.name)}</div>
                  <div className="mt-auto text-lg font-bold text-primary">{formatPrice(p.price)}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {products.data.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-8">
              Товары не найдены
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
