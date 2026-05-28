import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import type { Product } from '@/lib/types';
import { formatPrice, pickLocale } from '@/lib/utils';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/p/${product.slug}`}>
      <Card className="h-full hover:border-primary transition-colors">
        <CardContent className="p-4 flex flex-col gap-2 h-full">
          <div className="aspect-square bg-muted rounded-md flex items-center justify-center text-3xl">
            🔧
          </div>
          <div className="text-xs text-muted-foreground">
            {product.brand?.name ?? ''} {product.brand ? '· ' : ''}{product.merchant.brandName}
          </div>
          <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{pickLocale(product.name)}</div>
          {product.oemNumber ? (
            <div className="text-xs font-mono text-muted-foreground">OEM: {product.oemNumber}</div>
          ) : null}
          <div className="mt-auto pt-2">
            <div className="text-lg font-bold text-primary">{formatPrice(product.price)}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
