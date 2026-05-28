'use client';

import { Star, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import {
  useAddProductImage,
  useProductImages,
  useRemoveProductImage,
  useSetPrimaryImage,
} from '@/lib/api/images';
import { ApiHttpError } from '@/lib/api-client';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

interface Props {
  productId: string;
}

export function ImagesManager({ productId }: Props) {
  const images = useProductImages(productId);
  const add = useAddProductImage(productId);
  const remove = useRemoveProductImage(productId);
  const setPrimary = useSetPrimaryImage(productId);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      if (!ACCEPT.split(',').includes(file.type)) {
        toast.error(`${file.name}: формат не поддерживается`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: больше 8 МБ`);
        continue;
      }
      try {
        await add.mutateAsync(file);
        toast.success(`${file.name}: загружено`);
      } catch (error) {
        toast.error(
          error instanceof ApiHttpError ? error.body.message : `${file.name}: ошибка загрузки`,
        );
      }
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  const onRemove = async (id: string) => {
    if (!confirm('Удалить изображение?')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Удалено');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  const onSetPrimary = async (id: string) => {
    try {
      await setPrimary.mutateAsync(id);
      toast.success('Назначено основным');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="font-semibold">Изображения</h2>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={onChange}
            className="hidden"
          />
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div className="text-sm">
            {add.isPending ? (
              'Загружаем…'
            ) : (
              <>
                <span className="font-medium text-primary">Выберите файл</span> или перетащите
                сюда
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">JPG, PNG, WebP, AVIF · до 8 МБ</div>
        </label>

        {images.isLoading ? (
          <div className="text-sm text-muted-foreground">Загрузка…</div>
        ) : images.data && images.data.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {images.data.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {img.isPrimary ? (
                  <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    <Star className="h-2.5 w-2.5 fill-current" /> Основное
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetPrimary(img.id)}
                    disabled={setPrimary.isPending}
                    className="absolute left-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md bg-white/90 text-muted-foreground hover:text-primary group-hover:flex"
                    aria-label="Сделать основным"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(img.id)}
                  disabled={remove.isPending}
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md bg-white/90 text-destructive hover:bg-destructive hover:text-white group-hover:flex"
                  aria-label="Удалить"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Пока нет изображений. На карточке покажется плейсхолдер.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
