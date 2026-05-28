'use client';

import { useQuery } from '@tanstack/react-query';
import { Car, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { ProductCard } from '@/components/home/product-card';
import { useGarages } from '@/lib/api/garage';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import type { Paginated, Product } from '@/lib/types';

/**
 * Секция "Совместимо с вашим авто".
 * Видна только авторизованному пользователю с primary garage entry,
 * у которого указан carModification.
 */
export function MyCarProducts() {
  const token = useAuthStore((s) => s.accessToken);
  const garages = useGarages();
  const primary = garages.data?.find((g) => g.isPrimary && g.carModificationId);

  const products = useQuery<Paginated<Product>>({
    queryKey: ['my-car-products', primary?.carModificationId, token],
    queryFn: () =>
      apiFetch<Paginated<Product>>(
        `/products?carModificationId=${primary!.carModificationId}&perPage=8&sort=popular`,
      ),
    enabled: Boolean(token) && Boolean(primary?.carModificationId),
  });

  if (!token || !primary || !primary.carModification) return null;
  if (products.isLoading) {
    return (
      <section>
        <div className="mb-3 flex items-end justify-between px-4 md:px-0">
          <h2 className="text-lg font-bold md:text-xl">Совместимо с вашим авто</h2>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 w-[170px] shrink-0 animate-pulse rounded-2xl bg-secondary md:w-[220px]" />
          ))}
        </div>
      </section>
    );
  }
  if (!products.data?.data.length) return null;

  const car = primary.carModification;
  const carLabel = `${car.generation.model.make.name} ${car.generation.model.name} ${car.generation.name}`;
  const target = `/search?modificationId=${primary.carModificationId}&modificationName=${encodeURIComponent(
    `${carLabel} · ${car.name}`,
  )}`;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-2 px-4 md:px-0">
        <div className="min-w-0">
          <h2 className="text-lg font-bold md:text-xl">Совместимо с вашим авто</h2>
          <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Car className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">{carLabel} · {car.name}</span>
          </div>
        </div>
        <Link href={target} className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary hover:underline">
          Все
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
        {products.data.data.map((p) => (
          <div key={p.id} className="w-[170px] shrink-0 snap-start md:w-[220px]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
