'use client';

import { Check, Layers, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import {
  useCreateVariant,
  useDeleteVariant,
  useSetDefaultVariant,
  useUpdateVariant,
  type AdminVariant,
} from '@/lib/api/products';

function err(e: unknown) {
  return e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка';
}

/** Управление вариантами карточки (простой список): ярлык + основной + удаление. */
export function VariantsManager({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
  const create = useCreateVariant(productId);
  const update = useUpdateVariant(productId);
  const setDefault = useSetDefaultVariant(productId);
  const remove = useDeleteVariant(productId);
  const [label, setLabel] = useState('');

  async function add() {
    if (!label.trim()) {
      toast.error('Укажите ярлык варианта, напр. «4 л»');
      return;
    }
    try {
      const ru = label.trim();
      await create.mutateAsync({ name: { ru, uz: ru } });
      setLabel('');
      toast.success('Вариант добавлен');
    } catch (e) {
      toast.error(err(e));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Layers className="h-4 w-4" /> Варианты
          </h2>
          <span className="text-xs text-muted-foreground">{variants.length} шт.</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Вариативный товар (напр. объём/цвет). У каждого варианта свои предложения продавцов с
          ценой и остатком. Невариативный товар — один базовый вариант.
        </p>

        <div className="space-y-2">
          {variants.map((v) => (
            <VariantRow
              key={v.id}
              productId={productId}
              variant={v}
              canDelete={variants.length > 1}
              onRename={(name) => update.mutate({ variantId: v.id, body: { name } })}
              onDefault={() => setDefault.mutate(v.id)}
              onDelete={async () => {
                try {
                  await remove.mutateAsync(v.id);
                  toast.success('Вариант удалён');
                } catch (e) {
                  toast.error(err(e));
                }
              }}
            />
          ))}
        </div>

        <div className="flex gap-2 border-t border-border pt-3">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ярлык варианта, напр. «4 л»"
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button type="button" variant="outline" onClick={add} disabled={create.isPending}>
            <Plus className="h-4 w-4" /> Вариант
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VariantRow({
  variant,
  canDelete,
  onRename,
  onDefault,
  onDelete,
}: {
  productId: string;
  variant: AdminVariant;
  canDelete: boolean;
  onRename: (name: { ru: string; uz: string }) => void;
  onDefault: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(variant.name?.ru ?? '');

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2">
      {editing ? (
        <>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 flex-1"
            autoFocus
          />
          <button
            title="Сохранить"
            className="text-emerald-400 hover:text-emerald-300"
            onClick={() => {
              const ru = value.trim() || 'Базовый';
              onRename({ ru, uz: ru });
              setEditing(false);
            }}
          >
            <Check className="h-4 w-4" />
          </button>
        </>
      ) : (
        <button
          className="flex-1 text-left text-sm text-foreground hover:underline"
          onClick={() => setEditing(true)}
          title="Переименовать"
        >
          {variant.name?.ru ?? 'Базовый вариант'}
        </button>
      )}

      {variant.isDefault ? (
        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
          основной
        </span>
      ) : (
        <button
          title="Сделать основным"
          className="text-muted-foreground hover:text-amber-300"
          onClick={onDefault}
        >
          <Star className="h-4 w-4" />
        </button>
      )}
      {canDelete ? (
        <button
          title="Удалить"
          className="text-muted-foreground hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
