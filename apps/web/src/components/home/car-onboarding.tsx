'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';

export function CarOnboarding() {
  return (
    <div className="mx-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 md:mx-0">
      <div className="flex-1">
        <h3 className="text-sm font-bold md:text-base">Расскажите о вашем авто</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Добавьте машину — покажем совместимые запчасти
        </p>
        <Link
          href="/account/garage/add"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить машину
        </Link>
      </div>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-primary">
        ?
      </div>
    </div>
  );
}
