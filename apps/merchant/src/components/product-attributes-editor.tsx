'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCategoryAttributes, type CategoryAttribute } from '@/lib/api/catalog';
import type { MerchantProductAttribute, ProductAttributeValue } from '@/lib/api/products';
import { pickLocale } from '@/lib/utils';

type RawValue = string | boolean | string[];

interface Props {
  categoryId: string;
  initial?: MerchantProductAttribute[];
  onChange: (attributes: ProductAttributeValue[]) => void;
}

/**
 * Динамический редактор характеристик товара: подгружает атрибуты выбранной категории
 * и рендерит правильный тип поля для каждого (число, список, да/нет, текст).
 * Сообщает наверх массив значений, готовый к отправке в API.
 */
export function ProductAttributesEditor({ categoryId, initial, onChange }: Props) {
  const { data: attributes, isLoading } = useCategoryAttributes(categoryId);
  const [values, setValues] = useState<Record<string, RawValue>>({});

  // Префилл значений из существующего товара (edit-flow), когда подгрузились и атрибуты, и initial.
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!attributes || !initial) return;
    const key = `${categoryId}:${initial.length}`;
    if (prefilledFor.current === key) return;
    prefilledFor.current = key;
    const next: Record<string, RawValue> = {};
    for (const pa of initial) {
      const attr = attributes.find((a) => a.id === pa.attributeId);
      if (!attr) continue;
      next[attr.id] = readInitial(attr, pa);
    }
    setValues(next);
  }, [attributes, initial, categoryId]);

  // Пробрасываем наверх массив значений при любом изменении.
  const grouped = useMemo(() => groupByGroup(attributes ?? []), [attributes]);

  useEffect(() => {
    if (!attributes) return;
    const payload: ProductAttributeValue[] = [];
    for (const attr of attributes) {
      const raw = values[attr.id];
      const value = serialize(attr, raw);
      if (value) payload.push(value);
    }
    onChange(payload);
    // onChange намеренно не в deps — это стабильный setState-сеттер из родителя
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, attributes]);

  if (!categoryId) return null;
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Загрузка характеристик…</p>;
  }
  if (!attributes || attributes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Для этой категории характеристики не заданы. Их настраивает администратор в разделе
        «Характеристики».
      </p>
    );
  }

  const set = (id: string, v: RawValue) => setValues((prev) => ({ ...prev, [id]: v }));

  return (
    <div className="space-y-5">
      {grouped.map(({ group, items }) => (
        <div key={group?.id ?? 'ungrouped'} className="space-y-3">
          {group ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {pickLocale(group.name)}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((attr) => (
              <AttributeField
                key={attr.id}
                attr={attr}
                value={values[attr.id]}
                onChange={(v) => set(attr.id, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttributeField({
  attr,
  value,
  onChange,
}: {
  attr: CategoryAttribute;
  value: RawValue | undefined;
  onChange: (v: RawValue) => void;
}) {
  const label = (
    <Label className="text-sm">
      {pickLocale(attr.name)}
      {attr.unit ? <span className="text-muted-foreground">, {attr.unit}</span> : null}
      {attr.isRequired ? <span className="text-destructive"> *</span> : null}
    </Label>
  );

  if (attr.dataType === 'BOOLEAN') {
    return (
      <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {pickLocale(attr.name)}
      </label>
    );
  }

  if (attr.dataType === 'ENUM') {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          required={attr.isRequired}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">— не указано —</option>
          {(attr.enumValues ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {pickLocale(opt.label)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (attr.dataType === 'MULTI_ENUM') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5 md:col-span-2">
        {label}
        <div className="flex flex-wrap gap-2">
          {(attr.enumValues ?? []).map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() =>
                  onChange(on ? selected.filter((v) => v !== opt.value) : [...selected, opt.value])
                }
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors ' +
                  (on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent')
                }
              >
                {pickLocale(opt.label)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // STRING / NUMBER
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        type={attr.dataType === 'NUMBER' ? 'number' : 'text'}
        inputMode={attr.dataType === 'NUMBER' ? 'decimal' : undefined}
        required={attr.isRequired}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className={attr.dataType === 'NUMBER' ? 'tabular-nums' : undefined}
      />
    </div>
  );
}

// ---------- helpers ----------

function groupByGroup(attrs: CategoryAttribute[]) {
  const map = new Map<string, { group: CategoryAttribute['group']; items: CategoryAttribute[] }>();
  for (const a of attrs) {
    const key = a.group?.id ?? 'ungrouped';
    if (!map.has(key)) map.set(key, { group: a.group, items: [] });
    map.get(key)!.items.push(a);
  }
  return Array.from(map.values()).sort(
    (x, y) => (x.group?.position ?? 999) - (y.group?.position ?? 999),
  );
}

function readInitial(attr: CategoryAttribute, pa: MerchantProductAttribute): RawValue {
  switch (attr.dataType) {
    case 'BOOLEAN':
      return pa.valueBoolean === true;
    case 'NUMBER':
      return pa.valueNumber != null ? String(pa.valueNumber) : '';
    case 'ENUM':
      return pa.valueEnum ?? '';
    case 'MULTI_ENUM':
      return pa.valueMultiEnum ?? [];
    default:
      return pa.valueString ?? '';
  }
}

function serialize(
  attr: CategoryAttribute,
  raw: RawValue | undefined,
): ProductAttributeValue | null {
  switch (attr.dataType) {
    case 'BOOLEAN':
      return raw === true ? { attributeId: attr.id, valueBoolean: true } : null;
    case 'NUMBER': {
      if (typeof raw !== 'string' || raw.trim() === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? { attributeId: attr.id, valueNumber: n } : null;
    }
    case 'ENUM':
      return typeof raw === 'string' && raw ? { attributeId: attr.id, valueEnum: raw } : null;
    case 'MULTI_ENUM':
      return Array.isArray(raw) && raw.length > 0
        ? { attributeId: attr.id, valueMultiEnum: raw }
        : null;
    default:
      return typeof raw === 'string' && raw.trim() !== ''
        ? { attributeId: attr.id, valueString: raw.trim() }
        : null;
  }
}
