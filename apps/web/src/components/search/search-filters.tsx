'use client';

import { Car, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { CarPicker, type SelectedCar } from '@/components/car-picker';

interface Props {
  initial: {
    makeId?: string;
    makeName?: string;
    modelId?: string;
    modelName?: string;
    modificationId?: string;
    modificationName?: string;
  };
}

export function SearchFilters({ initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasCarFilter = Boolean(initial.makeId);
  const label = [initial.makeName, initial.modelName, initial.modificationName]
    .filter(Boolean)
    .join(' · ');

  const applyCar = (s: SelectedCar) => {
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
    if (s.modificationId) {
      params.set('modificationId', s.modificationId);
      params.set('modificationName', s.modificationName ?? '');
    } else {
      params.delete('modificationId');
      params.delete('modificationName');
    }
    params.delete('page');
    params.delete('vin');
    setPickerOpen(false);
    router.push(`/search?${params.toString()}`);
  };

  const clearCar = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ['makeId', 'makeName', 'modelId', 'modelName', 'modificationId', 'modificationName']) {
      params.delete(k);
    }
    router.push(`/search?${params.toString()}`);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
        >
          <Car className="h-3.5 w-3.5" />
          {hasCarFilter ? label : 'Выбрать автомобиль'}
        </button>
        {hasCarFilter ? (
          <button
            type="button"
            onClick={clearCar}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Сбросить
          </button>
        ) : null}
      </div>

      <CarPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={applyCar}
        minDepth="model"
        initial={initial}
      />
    </>
  );
}
