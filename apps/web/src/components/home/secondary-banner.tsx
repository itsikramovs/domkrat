import { ArrowRight, Tag } from 'lucide-react';
import Link from 'next/link';

import type { Banner } from '@/lib/types';
import { pickLocale } from '@/lib/utils';

export function SecondaryBanner({ banner }: { banner: Banner }) {
  const inner = (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent via-accent/80 to-white p-4 md:p-5">
      <div className="absolute right-3 top-3 hidden h-20 w-32 rounded-xl bg-white/60 shadow-sm md:block" />
      <div className="absolute -bottom-6 right-2 h-14 w-32 rounded-full bg-white/40" />
      <div className="relative max-w-[70%] space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          <Tag className="h-3 w-3" />
          МОЛНИЯ −30%
        </span>
        <h3 className="text-base font-bold leading-tight md:text-lg">
          {pickLocale(banner.title)}
        </h3>
        {banner.subtitle ? (
          <p className="text-xs text-muted-foreground">{pickLocale(banner.subtitle)}</p>
        ) : null}
        <div className="flex items-center gap-2 pt-1">
          <span className="rounded-md bg-foreground px-2 py-1 text-xs font-bold text-background">
            04 : 12 : 36
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            Купить со скидкой
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );

  return banner.linkUrl ? <Link href={banner.linkUrl}>{inner}</Link> : inner;
}
