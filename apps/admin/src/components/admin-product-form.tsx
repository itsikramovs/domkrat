'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCategoryAttributes,
  type AdminProductAttr,
  type AdminProductDetail,
  type CategoryAttribute,
  type CreateProductBody,
  type ProductAttrValue,
} from '@/lib/api/products';
import { useAdminBrands, useAdminCategories } from '@/lib/api/management';

interface Merchant {
  id: string;
  brandName: string;
}

interface Props {
  initial?: AdminProductDetail;
  merchants?: Merchant[]; // только для создания
  busy: boolean;
  submitLabel: string;
  onSubmit: (body: CreateProductBody) => Promise<void> | void;
}

const selectCls =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground';

export function AdminProductForm({ initial, merchants, busy, submitLabel, onSubmit }: Props) {
  const cats = useAdminCategories();
  const brands = useAdminBrands();
  const isEdit = Boolean(initial);

  const [merchantId, setMerchantId] = useState(initial?.merchant?.id ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [brandId, setBrandId] = useState(initial?.brandId ?? '');
  const [nameRu, setNameRu] = useState(initial?.name.ru ?? '');
  const [nameUz, setNameUz] = useState(initial?.name.uz ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [oemNumber, setOem] = useState(initial?.oemNumber ?? '');
  const [barcode, setBarcode] = useState(initial?.barcode ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [compareAtPrice, setCompare] = useState(initial?.compareAtPrice ?? '');
  const [vatRate, setVat] = useState(initial?.vatRate ? String(initial.vatRate) : '12');
  const [weight, setWeight] = useState(initial?.weight ?? '');
  const [descRu, setDescRu] = useState(initial?.description?.ru ?? '');
  const [descUz, setDescUz] = useState(initial?.description?.uz ?? '');
  const [attributes, setAttributes] = useState<ProductAttrValue[]>([]);

  const catOptions = useMemo(() => orderCats(cats.data ?? []), [cats.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: CreateProductBody = {
      merchantId,
      categoryId,
      brandId: brandId || undefined,
      name: { ru: nameRu.trim(), uz: nameUz.trim() || nameRu.trim() },
      sku: sku.trim(),
      price: Number(price),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
      vatRate: vatRate ? Number(vatRate) : undefined,
      oemNumber: oemNumber.trim() || undefined,
      barcode: barcode.trim() || undefined,
      weight: weight ? Number(weight) : undefined,
      description:
        descRu || descUz ? { ru: descRu || undefined, uz: descUz || undefined } : undefined,
      attributes,
    };
    await onSubmit(body);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Section
        title="Категория и продавец"
        desc="Категория задаёт характеристики и не меняется после создания (как в Ozon)."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {!isEdit ? (
            <Field label="Мерчант *">
              <select
                required
                className={selectCls}
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
              >
                <option value="">— выбрать —</option>
                {(merchants ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brandName}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Категория *">
            {isEdit ? (
              <Input value={initial?.category.name.ru ?? ''} disabled />
            ) : (
              <select
                required
                className={selectCls}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— выбрать —</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'— '.repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Бренд">
            <select
              className={selectCls}
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">— без бренда —</option>
              {(brands.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Основное">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название (RU) *">
            <Input required value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
          </Field>
          <Field label="Название (UZ)">
            <Input value={nameUz} onChange={(e) => setNameUz(e.target.value)} />
          </Field>
          {!isEdit ? (
            <Field label="Артикул (SKU) *">
              <Input
                required
                className="font-mono"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="BOSCH-1457433721"
              />
            </Field>
          ) : null}
          <Field label="OEM-номер">
            <Input
              className="font-mono"
              value={oemNumber}
              onChange={(e) => setOem(e.target.value)}
              placeholder="04465-33450"
            />
          </Field>
          <Field label="Штрихкод">
            <Input
              className="font-mono"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Характеристики" desc="Зависят от категории. Обязательные отмечены *.">
        {categoryId ? (
          <AttrEditor
            key={categoryId}
            categoryId={categoryId}
            initial={initial?.attributes}
            onChange={setAttributes}
          />
        ) : (
          <p className="text-sm text-white/55">Сначала выберите категорию.</p>
        )}
      </Section>

      <Section
        title={isEdit ? 'Вес' : 'Цена, НДС, вес'}
        desc={
          isEdit
            ? 'Цена и НДС задаются на предложениях продавцов (ниже).'
            : 'Цена/НДС первого предложения продавца.'
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          {!isEdit ? (
            <>
              <Field label="Цена, сум *">
                <Input
                  required
                  type="number"
                  min={0}
                  step={1000}
                  className="tabular-nums"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
              <Field label="Старая цена">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  className="tabular-nums"
                  value={compareAtPrice}
                  onChange={(e) => setCompare(e.target.value)}
                />
              </Field>
              <Field label="НДС, %">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  className="tabular-nums"
                  value={vatRate}
                  onChange={(e) => setVat(e.target.value)}
                />
              </Field>
            </>
          ) : null}
          <Field label="Вес, кг">
            <Input
              type="number"
              min={0}
              step={0.001}
              className="tabular-nums"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Описание">
        <Field label="Описание (RU)">
          <textarea
            value={descRu}
            onChange={(e) => setDescRu(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </Field>
        <Field label="Описание (UZ)">
          <textarea
            value={descUz}
            onChange={(e) => setDescUz(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </Field>
      </Section>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? 'Сохраняем…' : submitLabel}
      </Button>
    </form>
  );
}

// -------------------- attributes editor (inline) --------------------
type Raw = string | boolean | string[];

function AttrEditor({
  categoryId,
  initial,
  onChange,
}: {
  categoryId: string;
  initial?: AdminProductAttr[];
  onChange: (v: ProductAttrValue[]) => void;
}) {
  const { data: attrs, isLoading } = useCategoryAttributes(categoryId);
  const [values, setValues] = useState<Record<string, Raw>>({});

  useEffect(() => {
    if (!attrs || !initial) return;
    const next: Record<string, Raw> = {};
    for (const pa of initial) {
      const a = attrs.find((x) => x.id === pa.attributeId);
      if (!a) continue;
      next[a.id] =
        a.dataType === 'BOOLEAN'
          ? pa.valueBoolean === true
          : a.dataType === 'NUMBER'
            ? pa.valueNumber != null
              ? String(pa.valueNumber)
              : ''
            : a.dataType === 'ENUM'
              ? (pa.valueEnum ?? '')
              : a.dataType === 'MULTI_ENUM'
                ? (pa.valueMultiEnum ?? [])
                : (pa.valueString ?? '');
    }
    setValues(next);
  }, [attrs, initial]);

  useEffect(() => {
    if (!attrs) return;
    const out: ProductAttrValue[] = [];
    for (const a of attrs) {
      const raw = values[a.id];
      const v = serialize(a, raw);
      if (v) out.push(v);
    }
    onChange(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, attrs]);

  if (isLoading) return <p className="text-sm text-white/55">Загрузка характеристик…</p>;
  if (!attrs || attrs.length === 0)
    return (
      <p className="text-sm text-white/55">
        Для этой категории характеристики не заданы (настраиваются в разделе «Характеристики»).
      </p>
    );

  const set = (id: string, v: Raw) => setValues((p) => ({ ...p, [id]: v }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {attrs.map((a) => (
        <AttrField key={a.id} attr={a} value={values[a.id]} onChange={(v) => set(a.id, v)} />
      ))}
    </div>
  );
}

function AttrField({
  attr,
  value,
  onChange,
}: {
  attr: CategoryAttribute;
  value: Raw | undefined;
  onChange: (v: Raw) => void;
}) {
  const label = (
    <Label className="text-sm">
      {attr.name.ru}
      {attr.unit ? <span className="text-white/50">, {attr.unit}</span> : null}
      {attr.isRequired ? <span className="text-destructive"> *</span> : null}
    </Label>
  );
  if (attr.dataType === 'BOOLEAN') {
    return (
      <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {attr.name.ru}
      </label>
    );
  }
  if (attr.dataType === 'ENUM') {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          required={attr.isRequired}
          className={selectCls}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— не указано —</option>
          {(attr.enumValues ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label.ru}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (attr.dataType === 'MULTI_ENUM') {
    const sel = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5 md:col-span-2">
        {label}
        <div className="flex flex-wrap gap-2">
          {(attr.enumValues ?? []).map((o) => {
            const on = sel.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => onChange(on ? sel.filter((x) => x !== o.value) : [...sel, o.value])}
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors ' +
                  (on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent')
                }
              >
                {o.label.ru}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        type={attr.dataType === 'NUMBER' ? 'number' : 'text'}
        required={attr.isRequired}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className={attr.dataType === 'NUMBER' ? 'tabular-nums' : undefined}
      />
    </div>
  );
}

function serialize(a: CategoryAttribute, raw: Raw | undefined): ProductAttrValue | null {
  switch (a.dataType) {
    case 'BOOLEAN':
      return raw === true ? { attributeId: a.id, valueBoolean: true } : null;
    case 'NUMBER': {
      if (typeof raw !== 'string' || raw.trim() === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? { attributeId: a.id, valueNumber: n } : null;
    }
    case 'ENUM':
      return typeof raw === 'string' && raw ? { attributeId: a.id, valueEnum: raw } : null;
    case 'MULTI_ENUM':
      return Array.isArray(raw) && raw.length ? { attributeId: a.id, valueMultiEnum: raw } : null;
    default:
      return typeof raw === 'string' && raw.trim()
        ? { attributeId: a.id, valueString: raw.trim() }
        : null;
  }
}

// -------------------- shared bits --------------------
function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          {desc ? <p className="text-xs text-white/55">{desc}</p> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

type CatLite = { id: string; name: { ru: string }; parentId: string | null };
function orderCats(cats: CatLite[]): Array<{ id: string; name: string; depth: number }> {
  const byParent = new Map<string | null, CatLite[]>();
  for (const c of cats) {
    const k = c.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  const out: Array<{ id: string; name: string; depth: number }> = [];
  const walk = (pid: string | null, depth: number) => {
    for (const c of byParent.get(pid) ?? []) {
      out.push({ id: c.id, name: c.name.ru, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  if (out.length < cats.length) {
    const seen = new Set(out.map((o) => o.id));
    for (const c of cats) if (!seen.has(c.id)) out.push({ id: c.id, name: c.name.ru, depth: 0 });
  }
  return out;
}
