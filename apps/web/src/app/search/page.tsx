import { Car, ChevronRight, Info } from 'lucide-react';
import Link from 'next/link';

import { ProductCard } from '@/components/home/product-card';
import { SearchFilters } from '@/components/search/search-filters';
import { serverApi } from '@/lib/api-client';
import type { Paginated, Product } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Поиск' };

interface VinSearchResponse extends Paginated<Product> {
  vehicle: null | {
    vin: string;
    carModification: {
      id: string;
      name: string;
      generation: {
        name: string;
        yearFrom: number;
        yearTo: number | null;
        model: { name: string; make: { name: string } };
      };
    };
  };
}

interface PageProps {
  searchParams: {
    q?: string;
    vin?: string;
    makeId?: string;
    makeName?: string;
    modelId?: string;
    modelName?: string;
    modificationId?: string;
    modificationName?: string;
    page?: string;
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const api = serverApi();
  const page = searchParams.page ?? '1';
  let products: Paginated<Product> | null = null;
  let vehicle: VinSearchResponse['vehicle'] = null;
  let title = 'Поиск товаров';

  if (searchParams.vin) {
    const res = await api<VinSearchResponse>(
      `/search/by-vin?vin=${encodeURIComponent(searchParams.vin)}&page=${page}&perPage=24`,
    ).catch(() => null);
    if (res) {
      products = { data: res.data, meta: res.meta };
      vehicle = res.vehicle;
    }
    title = `Поиск по VIN: ${searchParams.vin}`;
  } else {
    const qs = new URLSearchParams({ page, perPage: '24', sort: 'popular' });
    if (searchParams.q) qs.set('search', searchParams.q);
    if (searchParams.makeId) qs.set('carMakeId', searchParams.makeId);
    if (searchParams.modelId) qs.set('carModelId', searchParams.modelId);
    if (searchParams.modificationId) qs.set('carModificationId', searchParams.modificationId);
    products = await api<Paginated<Product>>(`/products?${qs.toString()}`).catch(() => null);

    if (searchParams.q) title = `Поиск: «${searchParams.q}»`;
    else if (searchParams.makeName) title = `Запчасти для ${searchParams.makeName}`;
  }

  const items = products?.data ?? [];
  const total = products?.meta.total ?? 0;

  return (
    <div className="space-y-4 px-4 py-4 md:container md:px-0 md:py-8">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Главная</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Поиск</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-xl font-bold md:text-3xl">{title}</h1>
        <p className="text-xs text-muted-foreground">Найдено: {total}</p>
      </div>

      {/* VIN не распознан — подсказка */}
      {searchParams.vin && !vehicle ? (
        <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-foreground">VIN не распознан в нашем справочнике.</p>
            <p className="mt-0.5 text-muted-foreground">
              Выберите марку и модель вручную ниже — мы покажем только совместимые товары.
            </p>
          </div>
        </div>
      ) : null}

      {/* Найденный автомобиль */}
      {vehicle ? (
        <div className="flex items-center gap-3 rounded-2xl bg-accent px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          <div className="flex-1 text-sm">
            <div className="font-semibold">
              {vehicle.carModification.generation.model.make.name}{' '}
              {vehicle.carModification.generation.model.name}{' '}
              <span className="font-normal text-muted-foreground">
                {vehicle.carModification.generation.name}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {vehicle.carModification.name} ·{' '}
              {vehicle.carModification.generation.yearFrom}—
              {vehicle.carModification.generation.yearTo ?? 'н.в.'}
            </div>
          </div>
        </div>
      ) : null}

      {/* Фильтр по марке/модели */}
      <SearchFilters
        initial={{
          makeId: searchParams.makeId,
          makeName: searchParams.makeName,
          modelId: searchParams.modelId,
          modelName: searchParams.modelName,
          modificationId: searchParams.modificationId,
          modificationName: searchParams.modificationName,
        }}
      />

      {/* Сетка товаров */}
      {items.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
          Ничего не нашли. Попробуйте сменить фильтр.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
