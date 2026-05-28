import type { Product } from '@/lib/types';

import { ProductCard } from './product-card';

export function HorizontalProducts({ products }: { products: Product[] }) {
  if (!products.length) {
    return (
      <div className="px-4 text-sm text-muted-foreground md:px-0">Скоро появятся товары…</div>
    );
  }
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
      {products.map((p) => (
        <div key={p.id} className="w-[170px] shrink-0 snap-start md:w-[220px]">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
