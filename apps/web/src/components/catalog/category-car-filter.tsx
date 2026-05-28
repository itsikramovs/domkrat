'use client';

import { Car, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { CarPicker, type SelectedCar } from '@/components/car-picker';

interface Props {
  slug: string;
  initial: {
    makeId?: string;
    makeName?: string;
    modelId?: string;
    modelName?: string;
  };
}

export function CategoryCarFilter({ slug, initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const hasFilter = Boolean(initial.makeId);
  const label = [initial.makeName, initial.modelName].filter(Boolean).join(' · ');

  const apply = (s: SelectedCar) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('makeId', s.makeId);
    params.set('makeName', s.makeName);
    if (s.modelId) {
      params.set('modelId', s.modelId);
      params.set('modelName', s.modelName ?? '');
    } else {
      params.delete('modelId');
      params.delete('modelName');
    }
    params.delete('page');
    setOpen(false);
    router.push(`/c/${slug}?${params.toString()}`);
  };

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ['makeId', 'makeName', 'modelId', 'modelName']) params.delete(k);
    router.push(`/c/${slug}?${params.toString()}`);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
        >
          <Car className="h-3.5 w-3.5" />
          {hasFilter ? label : 'Подобрать по авто'}
        </button>
        {hasFilter ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Сбросить
          </button>
        ) : null}
      </div>

      <CarPicker open={open} onClose={() => setOpen(false)} onSelect={apply} minDepth="model" initial={initial} />
    </>
  );
}
