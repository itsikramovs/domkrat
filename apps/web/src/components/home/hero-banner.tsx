import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

import type { Banner } from '@/lib/types';
import { pickLocale } from '@/lib/utils';

export function HeroBanner({ banner }: { banner: Banner }) {
  const inner = (
    <div className="relative overflow-hidden rounded-3xl bg-hero text-hero-foreground">
      {/* Стилизованный фон автомобиля (CSS shapes — без реального изображения) */}
      <div className="absolute inset-0 opacity-60">
        <div className="absolute -right-12 top-1/2 h-44 w-72 -translate-y-1/2 rounded-full bg-primary/30 blur-2xl" />
        <div className="absolute right-4 bottom-2 h-24 w-40 rounded-[60%_40%_60%_40%/60%_50%_50%_40%] bg-white/10" />
        <div className="absolute right-6 bottom-4 h-16 w-32 rounded-[40%_60%_40%_60%/40%_60%_40%_60%] bg-white/5" />
      </div>
      <div className="relative flex flex-col gap-4 p-5 md:p-7">
        <div className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium">
          <Sparkles className="h-3 w-3" />
          Зимняя акция
        </div>
        <div className="max-w-[60%] space-y-1">
          <h1 className="text-xl font-bold leading-tight md:text-3xl">
            {pickLocale(banner.title)}
          </h1>
          {banner.subtitle ? (
            <p className="text-xs text-white/80 md:text-sm">{pickLocale(banner.subtitle)}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
        >
          Купить со скидкой
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return banner.linkUrl ? <Link href={banner.linkUrl}>{inner}</Link> : inner;
}
