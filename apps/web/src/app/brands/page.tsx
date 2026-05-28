import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { serverApi } from '@/lib/api-client';
import type { Brand } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Все бренды' };

export default async function BrandsPage() {
  const brands = await serverApi()<Brand[]>('/brands').catch(() => []);

  return (
    <div className="space-y-4 px-4 py-4 md:container md:px-0 md:py-8">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Главная</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Бренды</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-xl font-bold md:text-3xl">Бренды</h1>
        <p className="text-xs text-muted-foreground">Проверенные производители · {brands.length}</p>
      </div>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {brands.map((b) => (
          <li key={b.id}>
            <Link
              href={`/brands/${b.slug}`}
              className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center transition-colors hover:border-primary"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-base font-bold uppercase tracking-wider text-foreground">
                {b.name.slice(0, 4)}
              </div>
              <span className="line-clamp-2 text-xs font-medium leading-tight">{b.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
