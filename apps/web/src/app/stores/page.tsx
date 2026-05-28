import { Store } from 'lucide-react';
import Link from 'next/link';

import { serverApi } from '@/lib/api-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Магазины' };

interface MerchantSummary {
  id: string;
  brandName: string;
  slug: string;
  city?: string | null;
  logoUrl?: string | null;
}

export default async function StoresPage() {
  // Эндпоинт публичного списка мерчантов появится позже — сейчас заглушка.
  const merchants = await serverApi()<MerchantSummary[]>('/merchants').catch(
    () => [] as MerchantSummary[],
  );

  return (
    <div className="space-y-4 px-4 py-4 md:container md:px-0 md:py-8">
      <h1 className="text-xl font-bold md:text-3xl">Магазины</h1>
      <p className="text-sm text-muted-foreground">Проверенные продавцы автозапчастей</p>

      {merchants.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center">
          <Store className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Список магазинов скоро появится</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            На главную
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {merchants.map((m) => (
            <li key={m.id} className="rounded-2xl bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-base font-bold">
                  {m.brandName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold">{m.brandName}</div>
                  <div className="text-xs text-muted-foreground">{m.city ?? 'Узбекистан'}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
