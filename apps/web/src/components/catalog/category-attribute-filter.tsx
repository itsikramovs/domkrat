'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

type ML = { ru: string; uz: string };

export interface CategoryFacet {
  id: string;
  slug: string;
  name: ML;
  unit: string | null;
  dataType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM';
  enumValues: Array<{ value: string; label: ML }> | null;
  options: Array<{ value: string; count: number }>;
}

interface Props {
  slug: string;
  facets: CategoryFacet[];
}

/** Парсит "slug:v1,v2;slug2:v3" в Map<slug, Set<value>>. */
function parseAttrs(raw: string | null): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!raw) return map;
  for (const part of raw.split(';')) {
    const [s, vals] = part.split(':');
    if (!s || !vals) continue;
    map.set(s, new Set(vals.split(',').filter(Boolean)));
  }
  return map;
}

function serialize(map: Map<string, Set<string>>): string {
  return Array.from(map.entries())
    .filter(([, set]) => set.size > 0)
    .map(([s, set]) => `${s}:${Array.from(set).join(',')}`)
    .join(';');
}

export function CategoryAttributeFilter({ slug, facets }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => parseAttrs(searchParams.get('attrs')), [searchParams]);
  const selectedCount = useMemo(
    () => Array.from(selected.values()).reduce((acc, s) => acc + s.size, 0),
    [selected],
  );

  if (facets.length === 0) return null;

  const labelFor = (f: CategoryFacet, value: string): string => {
    const opt = f.enumValues?.find((o) => o.value === value);
    if (opt) return opt.label.ru;
    return f.unit ? `${value} ${f.unit}` : value;
  };

  const toggle = (attrSlug: string, value: string) => {
    const next = new Map(Array.from(selected.entries()).map(([k, v]) => [k, new Set(v)]));
    const set = next.get(attrSlug) ?? new Set<string>();
    set.has(value) ? set.delete(value) : set.add(value);
    if (set.size > 0) next.set(attrSlug, set);
    else next.delete(attrSlug);

    const params = new URLSearchParams(searchParams.toString());
    const str = serialize(next);
    if (str) params.set('attrs', str);
    else params.delete('attrs');
    params.delete('page');
    router.push(`/c/${slug}?${params.toString()}`);
  };

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('attrs');
    params.delete('page');
    router.push(`/c/${slug}?${params.toString()}`);
  };

  return (
    <div className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Характеристики
          {selectedCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {selectedCount}
            </span>
          ) : null}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {open ? 'скрыть' : 'показать'}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t px-4 py-4">
          {facets.map((f) => {
            const sel = selected.get(f.slug) ?? new Set<string>();
            return (
              <div key={f.id}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {f.name.ru}
                </div>
                <div className="flex flex-wrap gap-2">
                  {f.options.map((o) => {
                    const on = sel.has(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggle(f.slug, o.value)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:bg-accent',
                        )}
                      >
                        {labelFor(f, o.value)}
                        <span className={cn('ml-1', on ? 'opacity-80' : 'text-muted-foreground')}>
                          {o.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Сбросить характеристики
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
