'use client';

import { Car, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CarPicker, type SelectedCar } from '@/components/car-picker';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAddProductCompat,
  useProductCompatibility,
  useRemoveProductCompat,
} from '@/lib/api/products';
import { ApiHttpError } from '@/lib/api-client';

interface Props {
  productId: string;
}

export function CompatibilityManager({ productId }: Props) {
  const compats = useProductCompatibility(productId);
  const add = useAddProductCompat(productId);
  const remove = useRemoveProductCompat(productId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const addPicked = async (s: SelectedCar) => {
    setPickerOpen(false);
    try {
      await add.mutateAsync({
        carMakeId: !s.modelId ? s.makeId : undefined,
        carModelId: s.modelId && !s.modificationId ? s.modelId : undefined,
        carModificationId: s.modificationId,
      });
      toast.success('Совместимость добавлена');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  const onRemove = async (id: string) => {
    if (!confirm('Удалить связь?')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Удалено');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Совместимость с авто</h2>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </button>
        </div>

        {compats.isLoading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : compats.data?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Car className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            Товар пока не привязан ни к одному автомобилю. Покупатели смогут найти его только
            через поиск по SKU/OEM.
          </div>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {compats.data?.map((c) => {
              const label = c.carModification
                ? `${c.carModification.generation.model.make.name} ${c.carModification.generation.model.name} ${c.carModification.generation.name} · ${c.carModification.name}`
                : c.carModel
                ? `${c.carModel.make.name} ${c.carModel.name} (все модификации)`
                : c.carMake
                ? `${c.carMake.name} (все модели)`
                : '—';
              const years = c.yearFrom || c.yearTo ? ` ${c.yearFrom ?? '?'}—${c.yearTo ?? 'н.в.'}` : '';
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <span>
                    {label}
                    {years ? <span className="text-muted-foreground">{years}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(c.id)}
                    disabled={remove.isPending}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Удалить"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <CarPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addPicked}
        minDepth="modification"
      />
    </Card>
  );
}
