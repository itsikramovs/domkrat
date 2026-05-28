import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { CategoryTile } from '@/components/home/category-tile';
import { serverApi } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { pickLocale } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Каталог' };

export default async function CatalogPage() {
  const categories = await serverApi()<Category[]>('/categories').catch(() => []);

  return (
    <div className="space-y-5 px-4 py-4 md:container md:px-0 md:py-8">
      <h1 className="text-xl font-bold md:text-3xl">Каталог</h1>

      <section>
        <h2 className="mb-3 text-base font-semibold md:text-lg">Категории</h2>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4 lg:grid-cols-8">
          {categories.map((c) => (
            <CategoryTile key={c.id} category={c} />
          ))}
        </div>
      </section>

      {/* Список с подкатегориями */}
      <section className="space-y-1">
        <h2 className="mb-2 text-base font-semibold md:text-lg">Все разделы</h2>
        {categories.map((c) => (
          <div key={c.id} className="rounded-2xl bg-card">
            <Link
              href={`/c/${c.slug}`}
              className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary"
            >
              <span>{pickLocale(c.name)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {c.children && c.children.length > 0 ? (
              <div className="border-t px-4 py-2 text-xs">
                {c.children.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/c/${sub.slug}`}
                    className="mr-3 inline-block rounded-full px-2 py-1 text-muted-foreground hover:text-foreground"
                  >
                    {pickLocale(sub.name)}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
