import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductCard } from '@/components/home/product-card';
import { serverApi } from '@/lib/api-client';
import type { Category, Paginated, Product } from '@/lib/types';
import { cn, pickLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
  searchParams: { page?: string; sort?: string; priceMin?: string; priceMax?: string };
}

export async function generateMetadata({ params }: PageProps) {
  try {
    const api = serverApi();
    const cat = await api<Category>(`/categories/${params.slug}`);
    return { title: pickLocale(cat.name) };
  } catch {
    return { title: 'Категория' };
  }
}

const SORTS: Array<{ value: string; label: string }> = [
  { value: 'popular', label: 'Популярные' },
  { value: 'new', label: 'Новинки' },
  { value: 'price_asc', label: 'Цена ↑' },
  { value: 'price_desc', label: 'Цена ↓' },
  { value: 'rating', label: 'По рейтингу' },
];

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const api = serverApi();
  const category = await api<Category>(`/categories/${params.slug}`).catch(() => null);
  if (!category) notFound();

  const page = Number(searchParams.page ?? '1');
  const sort = searchParams.sort ?? 'popular';
  const qs = new URLSearchParams({
    categoryId: category.id,
    page: String(page),
    perPage: '24',
    sort,
  });
  if (searchParams.priceMin) qs.set('priceMin', searchParams.priceMin);
  if (searchParams.priceMax) qs.set('priceMax', searchParams.priceMax);

  const products = await api<Paginated<Product>>(`/products?${qs.toString()}`);

  return (
    <div className="space-y-4 px-4 py-4 md:container md:px-0 md:py-8">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Главная
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{pickLocale(category.name)}</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-xl font-bold md:text-3xl">{pickLocale(category.name)}</h1>
        <p className="text-xs text-muted-foreground">Найдено: {products.meta.total}</p>
      </div>

      {/* Подкатегории как чипы */}
      {category.children && category.children.length > 0 ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {category.children.map((sub) => (
            <Link
              key={sub.id}
              href={`/c/${sub.slug}`}
              className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {pickLocale(sub.name)}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Сортировка — горизонтальные чипы */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={`/c/${params.slug}?sort=${s.value}`}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              s.value === sort ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-accent',
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.data.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {products.data.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">В этой категории пока нет товаров</div>
      ) : null}

      {products.meta.totalPages > 1 ? (
        <div className="flex flex-wrap justify-center gap-2 pt-4">
          {Array.from({ length: products.meta.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/c/${params.slug}?page=${p}&sort=${sort}`}
              className={cn(
                'flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium',
                p === page ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent',
              )}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
