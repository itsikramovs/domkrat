'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiHttpError } from '@/lib/api-client';
import {
  useAdminCategories,
  useAttributeGroups,
  useAttributes,
  useDeleteAttribute,
  useDeleteAttributeGroup,
  useSaveAttribute,
  useSaveAttributeGroup,
  type AdminAttribute,
  type AdminAttributeGroup,
  type AttributeDataType,
} from '@/lib/api/management';

const DATA_TYPES: { value: AttributeDataType; label: string }[] = [
  { value: 'STRING', label: 'Строка' },
  { value: 'NUMBER', label: 'Число' },
  { value: 'BOOLEAN', label: 'Да/Нет' },
  { value: 'ENUM', label: 'Список (один)' },
  { value: 'MULTI_ENUM', label: 'Список (несколько)' },
];

const TYPE_LABEL: Record<AttributeDataType, string> = {
  STRING: 'Строка',
  NUMBER: 'Число',
  BOOLEAN: 'Да/Нет',
  ENUM: 'Список',
  MULTI_ENUM: 'Мульти-список',
};

function errMsg(err: unknown): string {
  return err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка';
}

export default function AttributesPage() {
  return (
    <AuthGate>
      <div className="container space-y-8 py-8">
        <h1 className="text-3xl font-bold tracking-tight">Характеристики</h1>
        <GroupsSection />
        <AttributesSection />
      </div>
    </AuthGate>
  );
}

// ----------------------------- Groups -----------------------------
function GroupsSection() {
  const groups = useAttributeGroups();
  const save = useSaveAttributeGroup();
  const del = useDeleteAttributeGroup();
  const [editing, setEditing] = useState<AdminAttributeGroup | null>(null);
  const [ru, setRu] = useState('');
  const [uz, setUz] = useState('');
  const [slug, setSlug] = useState('');

  const list = groups.data ?? [];

  function start(g: AdminAttributeGroup | null) {
    setEditing(g);
    setRu(g?.name.ru ?? '');
    setUz(g?.name.uz ?? '');
    setSlug(g?.slug ?? '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ id: editing?.id, body: { name: { ru, uz: uz || ru }, slug } });
      toast.success(editing ? 'Сохранено' : 'Группа создана');
      start(null);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить группу? Атрибуты останутся без группы.')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Удалено');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="text-sm font-semibold text-muted-foreground">Группы атрибутов</div>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Название (RU) *">
            <Input required value={ru} onChange={(e) => setRu(e.target.value)} />
          </Field>
          <Field label="Название (UZ)">
            <Input value={uz} onChange={(e) => setUz(e.target.value)} />
          </Field>
          <Field label="Slug *">
            <Input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="dimensions"
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={save.isPending}>
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
            {editing ? (
              <Button type="button" variant="outline" onClick={() => start(null)}>
                Отмена
              </Button>
            ) : null}
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          {list.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm"
            >
              <span className="font-medium">{g.name.ru}</span>
              <span className="text-xs text-muted-foreground">
                {g._count?.attributes ?? 0} атр.
              </span>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => start(g)}
              >
                ✎
              </button>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(g.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {list.length === 0 && !groups.isLoading ? (
            <span className="text-sm text-muted-foreground">Групп пока нет</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------- Attributes ---------------------------
type EnumRow = { value: string; ru: string; uz: string };

function AttributesSection() {
  const groups = useAttributeGroups();
  const attrs = useAttributes();
  const categories = useAdminCategories();
  const save = useSaveAttribute();
  const del = useDeleteAttribute();

  const [editing, setEditing] = useState<AdminAttribute | null>(null);
  const [ru, setRu] = useState('');
  const [uz, setUz] = useState('');
  const [slug, setSlug] = useState('');
  const [dataType, setDataType] = useState<AttributeDataType>('STRING');
  const [unit, setUnit] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isFilterable, setIsFilterable] = useState(true);
  const [isSearchable, setIsSearchable] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [enumRows, setEnumRows] = useState<EnumRow[]>([]);

  const list = attrs.data ?? [];
  const groupList = groups.data ?? [];
  const catList = categories.data ?? [];
  const catName = (id: string) => catList.find((c) => c.id === id)?.name.ru ?? id;
  const isEnum = dataType === 'ENUM' || dataType === 'MULTI_ENUM';

  function start(a: AdminAttribute | null) {
    setEditing(a);
    setRu(a?.name.ru ?? '');
    setUz(a?.name.uz ?? '');
    setSlug(a?.slug ?? '');
    setDataType(a?.dataType ?? 'STRING');
    setUnit(a?.unit ?? '');
    setGroupId(a?.attributeGroupId ?? '');
    setIsFilterable(a?.isFilterable ?? true);
    setIsSearchable(a?.isSearchable ?? false);
    setIsRequired(a?.isRequired ?? false);
    setCategoryIds(a?.categoryIds ?? []);
    setEnumRows(
      (a?.enumValues ?? []).map((v) => ({ value: v.value, ru: v.label.ru, uz: v.label.uz })),
    );
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: { ru, uz: uz || ru },
      slug,
      dataType,
      isFilterable,
      isSearchable,
      isRequired,
      categoryIds,
      ...(unit ? { unit } : {}),
      ...(groupId ? { attributeGroupId: groupId } : {}),
    };
    if (isEnum) {
      body.enumValues = enumRows
        .filter((r) => r.value.trim() && r.ru.trim())
        .map((r) => ({ value: r.value.trim(), label: { ru: r.ru, uz: r.uz || r.ru } }));
    }
    try {
      await save.mutateAsync({ id: editing?.id, body });
      toast.success(editing ? 'Сохранено' : 'Атрибут создан');
      start(null);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить атрибут?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Удалено');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="text-sm font-semibold">
            {editing ? 'Редактирование атрибута' : 'Новый атрибут'}
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Название (RU) *">
                <Input required value={ru} onChange={(e) => setRu(e.target.value)} />
              </Field>
              <Field label="Название (UZ)">
                <Input value={uz} onChange={(e) => setUz(e.target.value)} />
              </Field>
              <Field label="Slug *">
                <Input
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="width-mm"
                />
              </Field>
              <Field label="Тип данных *">
                <Select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value as AttributeDataType)}
                >
                  {DATA_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Группа">
                <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">— без группы —</option>
                  {groupList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name.ru}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Единица (для числа)">
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="мм" />
              </Field>
            </div>

            <div className="flex flex-wrap gap-4">
              <Check label="Фильтруемый" checked={isFilterable} onChange={setIsFilterable} />
              <Check label="В поиске" checked={isSearchable} onChange={setIsSearchable} />
              <Check label="Обязательный" checked={isRequired} onChange={setIsRequired} />
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Категории, к которым применима характеристика
                </span>
                <span className="text-xs text-muted-foreground">выбрано: {categoryIds.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Характеристика появится в форме товара для выбранных категорий и всех их
                подкатегорий.
              </p>
              {catList.length === 0 ? (
                <p className="text-xs text-muted-foreground">Категории не загружены</p>
              ) : (
                <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {orderCategories(catList).map(({ cat, depth }) => (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                      style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={categoryIds.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      <span className="truncate">{cat.name.ru}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {isEnum ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Опции списка</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEnumRows((r) => [...r, { value: '', ru: '', uz: '' }])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Опция
                  </Button>
                </div>
                {enumRows.map((row, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input
                      placeholder="value (код)"
                      value={row.value}
                      onChange={(e) =>
                        setEnumRows((r) =>
                          r.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="RU"
                      value={row.ru}
                      onChange={(e) =>
                        setEnumRows((r) =>
                          r.map((x, j) => (j === i ? { ...x, ru: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="UZ"
                      value={row.uz}
                      onChange={(e) =>
                        setEnumRows((r) =>
                          r.map((x, j) => (j === i ? { ...x, uz: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEnumRows((r) => r.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {enumRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Добавьте хотя бы одну опцию</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                {editing ? 'Сохранить' : 'Создать'}
              </Button>
              {editing ? (
                <Button type="button" variant="outline" onClick={() => start(null)}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {attrs.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.name.ru}</span>
                    <Badge variant="secondary">{TYPE_LABEL[a.dataType]}</Badge>
                    {a.unit ? (
                      <span className="text-xs text-muted-foreground">{a.unit}</span>
                    ) : null}
                    {a.isFilterable ? <Badge variant="outline">фильтр</Badge> : null}
                    {a.isRequired ? <Badge variant="outline">обяз.</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.slug}
                    {a.group ? ` · ${a.group.name.ru}` : ''}
                    {a.enumValues?.length ? ` · ${a.enumValues.length} опц.` : ''}
                    {a._count?.productAttributes ? ` · ${a._count.productAttributes} товаров` : ''}
                  </div>
                  {a.categoryIds?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.categoryIds.slice(0, 4).map((id) => (
                        <Badge key={id} variant="outline" className="text-[10px]">
                          {catName(id)}
                        </Badge>
                      ))}
                      {a.categoryIds.length > 4 ? (
                        <span className="text-[10px] text-muted-foreground">
                          +{a.categoryIds.length - 4}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-1 text-[10px] text-amber-600">
                      ⚠ не привязана к категориям — не появится в форме товара
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => start(a)}>
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(a.id)}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Атрибутов пока нет</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ----------------------------- shared bits -----------------------------
type CatLite = { id: string; name: { ru: string }; parentId: string | null };

/** Раскладывает плоский список категорий в дерево-порядок с глубиной для отступов. */
function orderCategories(cats: CatLite[]): Array<{ cat: CatLite; depth: number }> {
  const byParent = new Map<string | null, CatLite[]>();
  for (const c of cats) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const out: Array<{ cat: CatLite; depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ cat: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  // На случай «осиротевших» (parent не в списке) — добавим остаток.
  if (out.length < cats.length) {
    const seen = new Set(out.map((o) => o.cat.id));
    for (const c of cats) if (!seen.has(c.id)) out.push({ cat: c, depth: 0 });
  }
  return out;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
    />
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input"
      />
      {label}
    </label>
  );
}
