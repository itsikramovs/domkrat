'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';

import { setLocale } from '@/i18n/actions';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';

export function LangSwitcher() {
  const current = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex items-center rounded-md border bg-background text-xs">
      {SUPPORTED_LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          disabled={pending || loc === current}
          onClick={() => {
            const fd = new FormData();
            fd.set('locale', loc);
            startTransition(() => {
              void setLocale(fd);
            });
          }}
          className={`px-2 py-1 uppercase font-medium transition-colors ${
            loc === current
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          }`}
          aria-pressed={loc === current}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
