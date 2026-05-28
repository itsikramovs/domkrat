// @domkrat/i18n — централизованные переводы и утилиты локализации.
// Реальные переводы (UI, ошибки, SMS/email шаблоны) — Sprint 1+.

export const SUPPORTED_LOCALES = ['ru', 'uz'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ru';

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
