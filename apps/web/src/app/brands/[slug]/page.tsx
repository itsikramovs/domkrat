import { ChevronRight, Globe } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductCard } from '@/components/home/product-card';
import { serverApi } from '@/lib/api-client';
import type { Brand, Paginated, Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
  searchParams: { page?: string; sort?: string };
}

export async function generateMetadata({ params }: PageProps) {
  try {
    const b = await serverApi()<Brand>(`/brands/${params.slug}`);
    return { title: b.name };
  } catch {
    return { title: 'Бренд' };
  }
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const api = serverApi();
  const brand = await api<Brand & { countryOfOrigin?: string | null; website?: string | null }>(
    `/brands/${params.slug}`,
  ).catch(() => null);
  if (!brand) notFound();

  const page = Number(searchParams.page ?? '1');
  const sort = searchParams.sort ?? 'popular';
  const products = await api<Paginated<Product>>(
    `/products?brandSlug=${params.slug}&page=${page}&perPage=24&sort=${sort}`,
  );

  return (
    <div className="space-y-5 px-4 py-4 md:container md:px-0 md:py-8">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Главная</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/brands" className="hover:text-foreground">Бренды</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{brand.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold uppercase">
          {brand.name.slice(0, 4)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold md:text-2xl">{brand.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {brand.countryOfOrigin ? <span>{brand.countryOfOrigin}</span> : null}
            {brand.website ? (
              <a
                href={brand.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3 w-3" />
                Официальный сайт
              </a>
            ) : null}
            <span>· Товаров: {products.meta.total}</span>
          </div>
        </div>
      </div>

      {products.data.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
          У бренда пока нет активных товаров.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
