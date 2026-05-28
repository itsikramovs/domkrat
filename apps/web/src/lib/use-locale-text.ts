'use client';

import { useLocale } from 'next-intl';

import { type Locale, isLocale } from '@/i18n/config';
import { pickLocale } from '@/lib/utils';

/**
 * Хук для client components — выбирает строку из JSONB {ru, uz} по текущей локали.
 * Для server components используйте pickLocale(value, locale) с локалью из cookies.
 */
export function useLocaleText(): (json: unknown) => string {
  const raw = useLocale();
  const locale: Locale = isLocale(raw) ? raw : 'ru';
  return (json) => pickLocale(json, locale);
}
