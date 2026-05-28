import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api-client';
import type { Category, Paginated, Product } from '@/lib/types';
import { pickLocale } from '@/lib/utils';

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
    <div className="container py-8 space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Главная</Link> /{' '}
        <span className="text-foreground">{pickLocale(category.name)}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{pickLocale(category.name)}</h1>
          <p className="text-sm text-muted-foreground mt-1">Найдено: {products.meta.total}</p>
        </div>
        <div className="flex gap-2 flex-wrap text-sm">
          <SortLink current={sort} value="popular" slug={params.slug}>По популярности</SortLink>
          <SortLink current={sort} value="new" slug={params.slug}>Новые</SortLink>
          <SortLink current={sort} value="price_asc" slug={params.slug}>Цена ↑</SortLink>
          <SortLink current={sort} value="price_desc" slug={params.slug}>Цена ↓</SortLink>
          <SortLink current={sort} value="rating" slug={params.slug}>Рейтинг</SortLink>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.data.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>

      {products.data.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">В этой категории пока нет товаров</div>
      ) : null}

      {products.meta.totalPages > 1 ? (
        <div className="flex justify-center gap-2 pt-4">
          {Array.from({ length: products.meta.totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              asChild
              size="sm"
              variant={p === page ? 'default' : 'outline'}
            >
              <Link href={`/c/${params.slug}?page=${p}&sort=${sort}`}>{p}</Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SortLink({
  current,
  value,
  slug,
  children,
}: {
  current: string;
  value: string;
  slug: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={`/c/${slug}?sort=${value}`}
      className={`px-3 py-1 rounded border ${active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
    >
      {children}
    </Link>
  );
}
