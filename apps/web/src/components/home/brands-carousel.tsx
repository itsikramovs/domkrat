import Link from 'next/link';

import type { Brand } from '@/lib/types';

export function BrandsCarousel({ brands }: { brands: Brand[] }) {
  if (!brands.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      {brands.map((b) => (
        <Link
          key={b.id}
          href={`/brands/${b.slug}`}
          className="flex shrink-0 snap-start flex-col items-center gap-1.5"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-base font-bold uppercase tracking-wider text-foreground shadow-sm">
            {b.name.slice(0, 5)}
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {b.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
