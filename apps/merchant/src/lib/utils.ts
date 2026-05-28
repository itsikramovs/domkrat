import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: string | number, currency = 'UZS'): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '—';
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num);
  return `${formatted} ${currency === 'UZS' ? 'сум' : currency}`;
}

export function pickLocale(json: unknown, locale: 'ru' | 'uz' = 'ru'): string {
  if (!json || typeof json !== 'object') return '';
  const obj = json as { ru?: string; uz?: string };
  return obj[locale] ?? obj.ru ?? '';
}
