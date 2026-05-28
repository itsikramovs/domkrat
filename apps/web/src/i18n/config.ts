export const SUPPORTED_LOCALES = ['ru', 'uz'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';
export const LOCALE_COOKIE = 'domkrat_locale';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'ru' || value === 'uz';
}
