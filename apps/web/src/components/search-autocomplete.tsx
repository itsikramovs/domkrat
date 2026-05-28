'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api-client';
import { formatPrice } from '@/lib/utils';

interface MeiliHit {
  id: string;
  sku: string;
  slug: string;
  nameRu: string;
  brand: string | null;
  category: string | null;
  price: number;
  imageUrl: string | null;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** Где якорить дропдаун: full-screen overlay на мобильном, относительный popover на десктопе */
  position?: 'mobile' | 'desktop';
}

export function SearchAutocomplete({ value, onChange, onSubmit, placeholder, position = 'mobile' }: Props) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 200);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggest = useQuery({
    queryKey: ['search-suggest', debounced],
    queryFn: () =>
      apiFetch<{ hits: MeiliHit[]; estimatedTotalHits: number }>(
        `/search/suggest?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.length >= 2 && open,
    staleTime: 30_000,
  });

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          onSubmit();
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder ?? 'Искать запчасти, бренды, артикулы…'}
            aria-label="Поиск"
            className={
              position === 'mobile'
                ? 'h-11 w-full rounded-full bg-secondary border border-transparent pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
                : 'h-11 w-full rounded-md border border-input bg-background pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
            }
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </form>

      {open && debounced.length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl">
          {suggest.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Ищем…</div>
          ) : suggest.data && suggest.data.hits.length > 0 ? (
            <ul className="divide-y">
              {suggest.data.hits.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/p/${h.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-secondary"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                      {h.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base">🔧</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium">{h.nameRu}</div>
                      <div className="text-xs text-muted-foreground">
                        {[h.brand, h.category].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{formatPrice(h.price)}</div>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`/search?q=${encodeURIComponent(value)}`}
                  onClick={() => setOpen(false)}
                  className="block bg-secondary/50 px-3 py-2 text-center text-sm font-medium text-primary hover:bg-secondary"
                >
                  Показать все результаты ({suggest.data.estimatedTotalHits}) →
                </Link>
              </li>
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Ничего не найдено</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
