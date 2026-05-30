'use client';

import { ArrowLeft, CheckCircle2, ImagePlus, PackageCheck, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { AdminProductForm } from '@/components/admin-product-form';
import { OffersManager } from '@/components/offers-manager';
import { ProductImages } from '@/components/product-images';
import { VariantsManager } from '@/components/variants-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch, ApiHttpError } from '@/lib/api-client';
import { useAdminMerchants } from '@/lib/api/admin';
import { uploadProductImage, useAdminProduct, useCreateAdminProduct } from '@/lib/api/products';

export default function NewAdminProductPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [createdId, setCreatedId] = useState<string | null>(null);

  return (
    <div className="container max-w-4xl space-y-5 py-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/catalog/products" aria-label="Назад">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Новый товар</h1>
          <p className="text-sm text-muted-foreground">
            {createdId
              ? 'Шаг 2 из 2 — варианты, предложения продавцов и приход на склад.'
              : 'Шаг 1 из 2 — контент карточки, фото и первое предложение продавца.'}
          </p>
        </div>
      </div>

      {createdId ? <EnrichStep productId={createdId} /> : <CreateStep onCreated={setCreatedId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Шаг 1: контент + буфер фото + первое предложение → создаёт карточку.
// ---------------------------------------------------------------------------
function CreateStep({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useCreateAdminProduct();
  const merchants = useAdminMerchants({ status: 'ACTIVE' });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <ImagePlus className="h-4 w-4" /> Фотографии
            </h2>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Добавить
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Фото загрузятся в карточку сразу после её создания. Первое станет главным.
          </p>
          {files.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-muted-foreground">
              Фото пока не выбраны.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {previews.map((p, i) => (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="aspect-square w-full object-cover" />
                  {i === 0 ? (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      Главное
                    </span>
                  ) : null}
                  <button
                    title="Убрать"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AdminProductForm
        merchants={(merchants.data?.data ?? []).map((m) => ({ id: m.id, brandName: m.brandName }))}
        busy={create.isPending || uploading}
        submitLabel={uploading ? 'Загружаем фото…' : 'Создать карточку'}
        onSubmit={async (body) => {
          let created: { id: string } | null = null;
          try {
            created = await create.mutateAsync(body);
          } catch (e) {
            const msg = e instanceof ApiHttpError ? e.body.message : 'Ошибка';
            toast.error(Array.isArray(msg) ? msg.join('; ') : String(msg));
            return;
          }
          // Карточка создана — загрузка фото НЕ должна терять её при сбое MinIO.
          if (files.length > 0) {
            setUploading(true);
            let idx = 0;
            let failed = 0;
            for (const file of files) {
              try {
                const url = await uploadProductImage(created.id, file);
                await apiFetch(`/admin/products/${created.id}/images`, {
                  method: 'POST',
                  body: { url, isPrimary: idx === 0 },
                });
              } catch {
                failed++;
              }
              idx++;
            }
            setUploading(false);
            if (failed > 0)
              toast.warning(`Часть фото не загрузилась (${failed}) — добавьте на шаге 2`);
          }
          toast.success('Карточка создана. Добавьте варианты, предложения и приход.');
          onCreated(created.id);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Шаг 2: фото (загруженные) + варианты + предложения + приход.
// ---------------------------------------------------------------------------
function EnrichStep({ productId }: { productId: string }) {
  const router = useRouter();
  const product = useAdminProduct(productId);

  if (product.isLoading || !product.data) {
    return <div className="py-8 text-muted-foreground">Загрузка карточки…</div>;
  }
  const p = product.data;
  const hasStock = p.offers.some((o) => o.stock > 0);

  return (
    <div className="space-y-5">
      <Card className="border-emerald-400/40">
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          <span className="flex-1">
            Карточка создана как черновик.{' '}
            {hasStock
              ? 'Остаток есть — товар активирован и продаётся.'
              : 'Оприходуйте хотя бы одно предложение (ниже) — после прихода товар станет ACTIVE и попадёт в каталог.'}
          </span>
        </CardContent>
      </Card>

      <ProductImages productId={p.id} images={p.images} />
      <VariantsManager productId={p.id} variants={p.variants} />
      <OffersManager productId={p.id} variants={p.variants} offers={p.offers} />

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => router.push(`/catalog/products/${p.id}`)}>
          <PackageCheck className="h-4 w-4" /> Готово — к товару
        </Button>
        <Button variant="outline" onClick={() => router.push('/catalog/products')}>
          К списку товаров
        </Button>
      </div>
    </div>
  );
}
