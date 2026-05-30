'use client';

import { Star, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiHttpError } from '@/lib/api-client';
import {
  uploadProductImage,
  useAddProductImage,
  useRemoveProductImage,
  useSetPrimaryImage,
} from '@/lib/api/products';

/** Управление фотографиями карточки (загрузка в MinIO, главное фото, удаление). */
export function ProductImages({
  productId,
  images,
}: {
  productId: string;
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = useAddProductImage(productId);
  const remove = useRemoveProductImage(productId);
  const setPrimary = useSetPrimaryImage(productId);
  const list = images ?? [];

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(productId, file);
        await add.mutateAsync({ url, isPrimary: list.length === 0 });
      }
      toast.success('Фото загружено');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : (e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Фотографии</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> {busy ? 'Загрузка…' : 'Загрузить'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-muted-foreground">
            Нет фото. Загрузите главное изображение и дополнительные.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {list.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                {img.isPrimary ? (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    Главное
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!img.isPrimary ? (
                    <button
                      title="Сделать главным"
                      onClick={() => setPrimary.mutate(img.id)}
                      className="text-white hover:text-amber-300"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    title="Удалить"
                    onClick={() => remove.mutate(img.id)}
                    className="text-white hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
