'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProductAttributesEditor } from '@/components/product-attributes-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBrands, useCategories } from '@/lib/api/catalog';
import type {
  CreateProductInput,
  MerchantProduct,
  ProductAttributeValue,
} from '@/lib/api/products';
import type { Category } from '@/lib/types';
import { pickLocale } from '@/lib/utils';

interface Props {
  initial?: MerchantProduct;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: CreateProductInput) => Promise<void> | void;
}

function flatten(cats: Category[], depth = 0): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const c of cats) {
    out.push({ id: c.id, label: `${'— '.repeat(depth)}${pickLocale(c.name)}` });
    if (c.children?.length) out.push(...flatten(c.children, depth + 1));
  }
  return out;
}

export function ProductForm({ initial, busy, submitLabel, onSubmit }: Props) {
  const cats = useCategories();
  const brands = useBrands();

  const [nameRu, setNameRu] = useState(initial?.name.ru ?? '');
  const [nameUz, setNameUz] = useState(initial?.name.uz ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [brandId, setBrandId] = useState<string>(initial?.brandId ?? '');
  const [oemNumber, setOemNumber] = useState(initial?.oemNumber ?? '');
  const [price, setPrice] = useState<string>(initial ? String(initial.price) : '');
  const [compareAtPrice, setCompareAtPrice] = useState<string>(
    initial?.compareAtPrice ? String(initial.compareAtPrice) : '',
  );
  const [vatRate, setVatRate] = useState<string>(initial?.vatRate ? String(initial.vatRate) : '12');
  const [descriptionRu, setDescriptionRu] = useState(initial?.description?.ru ?? '');
  const [descriptionUz, setDescriptionUz] = useState(initial?.description?.uz ?? '');
  const [attributes, setAttributes] = useState<ProductAttributeValue[]>([]);

  const handleAttributesChange = useCallback((next: ProductAttributeValue[]) => {
    setAttributes(next);
  }, []);

  // Если приходит initial асинхронно (edit-flow), синхронизируем
  useEffect(() => {
    if (!initial) return;
    setNameRu(initial.name.ru);
    setNameUz(initial.name.uz);
    setSku(initial.sku);
    setCategoryId(initial.categoryId);
    setBrandId(initial.brandId ?? '');
    setOemNumber(initial.oemNumber ?? '');
    setPrice(String(initial.price));
    setCompareAtPrice(initial.compareAtPrice ? String(initial.compareAtPrice) : '');
    setVatRate(String(initial.vatRate ?? '12'));
    setDescriptionRu(initial.description?.ru ?? '');
    setDescriptionUz(initial.description?.uz ?? '');
  }, [initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateProductInput = {
      name: { ru: nameRu.trim(), uz: nameUz.trim() || nameRu.trim() },
      sku: sku.trim(),
      categoryId,
      brandId: brandId || undefined,
      oemNumber: oemNumber.trim() || undefined,
      price: Number(price),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
      vatRate: vatRate ? Number(vatRate) : undefined,
      description:
        descriptionRu || descriptionUz
          ? { ru: descriptionRu || undefined, uz: descriptionUz || undefined }
          : undefined,
      attributes,
    };
    await onSubmit(payload);
  };

  const catOptions = cats.data ? flatten(cats.data) : [];

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Основное</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название (RU)" required>
              <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} required />
            </Field>
            <Field label="Название (UZ)">
              <Input value={nameUz} onChange={(e) => setNameUz(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="SKU (артикул)" required>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                className="font-mono"
                placeholder="BOSCH-1457433721"
              />
            </Field>
            <Field label="OEM-номер">
              <Input
                value={oemNumber}
                onChange={(e) => setOemNumber(e.target.value)}
                className="font-mono"
                placeholder="04465-33450"
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Категория" required>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— выбрать —</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Бренд">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— без бренда —</option>
                {brands.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Цена и НДС</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Цена, сум" required>
              <Input
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="tabular-nums"
              />
            </Field>
            <Field label="Старая цена (для скидки)">
              <Input
                type="number"
                min={0}
                step={1000}
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="НДС, %">
              <Input
                type="number"
                min={0}
                max={30}
                step={1}
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="font-semibold">Характеристики</h2>
            <p className="text-sm text-muted-foreground">
              Зависят от выбранной категории. Заполняйте обязательные (отмечены *) — по ним
              покупатели фильтруют товары.
            </p>
          </div>
          {categoryId ? (
            <ProductAttributesEditor
              key={categoryId}
              categoryId={categoryId}
              initial={initial?.attributes}
              onChange={handleAttributesChange}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Сначала выберите категорию выше.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Описание</h2>
          <Field label="Описание (RU)">
            <textarea
              value={descriptionRu}
              onChange={(e) => setDescriptionRu(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Описание (UZ)">
            <textarea
              value={descriptionUz}
              onChange={(e) => setDescriptionUz(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? 'Сохраняем…' : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
