'use client';

import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderTree,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAdminCategories,
  useDeleteCategory,
  useSaveCategory,
  type AdminCategory,
} from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface TreeNode extends AdminCategory {
  children: TreeNode[];
}

function buildTree(flat: AdminCategory[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const c of flat) byId.set(c.id, { ...c, children: [] });
  for (const c of flat) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.name.ru.localeCompare(b.name.ru));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

type FormState = {
  id?: string;
  ru: string;
  uz: string;
  slug: string;
  parentId: string;
  position: string;
  iconUrl: string;
  descriptionRu: string;
  isActive: boolean;
};

const emptyForm = (parentId = ''): FormState => ({
  ru: '',
  uz: '',
  slug: '',
  parentId,
  position: '0',
  iconUrl: '',
  descriptionRu: '',
  isActive: true,
});

export default function CategoriesPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const categories = useAdminCategories();
  const save = useSaveCategory();
  const del = useDeleteCategory();

  const [form, setForm] = useState<FormState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const flat = categories.data ?? [];
  const tree = useMemo(() => buildTree(flat), [flat]);
  const orderedForSelect = useMemo(() => flattenForSelect(tree), [tree]);

  function startEdit(c: AdminCategory) {
    setForm({
      id: c.id,
      ru: c.name.ru,
      uz: c.name.uz ?? '',
      slug: c.slug,
      parentId: c.parentId ?? '',
      position: String(c.position ?? 0),
      iconUrl: c.iconUrl ?? '',
      descriptionRu: c.description?.ru ?? '',
      isActive: c.isActive,
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const body: Record<string, unknown> = {
      name: { ru: form.ru, uz: form.uz || form.ru },
      slug: form.slug,
      position: Number(form.position) || 0,
      isActive: form.isActive,
      parentId: form.parentId || null,
      iconUrl: form.iconUrl || undefined,
      ...(form.descriptionRu
        ? { description: { ru: form.descriptionRu, uz: form.descriptionRu } }
        : {}),
    };
    try {
      await save.mutateAsync({ id: form.id, body });
      toast.success(form.id ? 'Категория сохранена' : 'Категория создана');
      setForm(null);
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  async function toggleActive(c: AdminCategory) {
    try {
      await save.mutateAsync({ id: c.id, body: { isActive: !c.isActive } });
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  async function move(node: TreeNode, siblings: TreeNode[], dir: -1 | 1) {
    const idx = siblings.findIndex((s) => s.id === node.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        save.mutateAsync({ id: node.id, body: { position: swap.position } }),
        save.mutateAsync({ id: swap.id, body: { position: node.position } }),
      ]);
    } catch {
      toast.error('Не удалось переместить');
    }
  }

  async function remove(c: AdminCategory) {
    if (!confirm(`Удалить «${c.name.ru}»? (только пустую категорию без подкатегорий)`)) return;
    try {
      await del.mutateAsync(c.id);
      toast.success('Удалено');
    } catch (err) {
      toast.error(err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка');
    }
  }

  const rootCount = tree.length;
  const total = flat.length;

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <FolderTree className="h-7 w-7 text-primary" /> Категории
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} категорий · {rootCount} корневых. Перетаскивание заменено стрелками ↑↓ внутри
            уровня.
          </p>
        </div>
        <Button onClick={() => setForm(emptyForm())}>
          <Plus className="h-4 w-4" /> Создать категорию
        </Button>
      </div>

      {form ? (
        <Card className="border-primary/40">
          <CardContent className="p-4">
            <div className="mb-3 text-sm font-semibold">
              {form.id ? 'Редактирование категории' : 'Новая категория'}
            </div>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Название (RU) *">
                <Input
                  required
                  value={form.ru}
                  onChange={(ev) => setForm({ ...form, ru: ev.target.value })}
                />
              </Field>
              <Field label="Название (UZ)">
                <Input
                  value={form.uz}
                  onChange={(ev) => setForm({ ...form, uz: ev.target.value })}
                />
              </Field>
              <Field label="Slug *">
                <Input
                  required
                  value={form.slug}
                  onChange={(ev) => setForm({ ...form, slug: ev.target.value })}
                  placeholder="brake-system"
                  className="font-mono"
                />
              </Field>
              <Field label="Родительская категория">
                <Select
                  value={form.parentId}
                  onChange={(ev) => setForm({ ...form, parentId: ev.target.value })}
                >
                  <option value="">— корневая —</option>
                  {orderedForSelect
                    .filter((o) => o.id !== form.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {' '.repeat(o.depth * 3)}
                        {o.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Позиция">
                <Input
                  type="number"
                  value={form.position}
                  onChange={(ev) => setForm({ ...form, position: ev.target.value })}
                />
              </Field>
              <Field label="Иконка (URL)">
                <Input
                  value={form.iconUrl}
                  onChange={(ev) => setForm({ ...form, iconUrl: ev.target.value })}
                  placeholder="/categories/brake.svg"
                />
              </Field>
              <Field label="Описание (RU)" className="sm:col-span-2 lg:col-span-3">
                <Input
                  value={form.descriptionRu}
                  onChange={(ev) => setForm({ ...form, descriptionRu: ev.target.value })}
                />
              </Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={form.isActive}
                  onChange={(ev) => setForm({ ...form, isActive: ev.target.checked })}
                />
                Активна (видна покупателям)
              </label>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={save.isPending}>
                  {form.id ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {categories.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : tree.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Категорий пока нет. Нажмите «Создать категорию».
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-2">
            <ul>
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  siblings={tree}
                  depth={0}
                  collapsed={collapsed}
                  onToggleCollapse={toggleCollapse}
                  onEdit={startEdit}
                  onAddChild={(p) => setForm(emptyForm(p.id))}
                  onToggleActive={toggleActive}
                  onMove={move}
                  onRemove={remove}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TreeRow({
  node,
  siblings,
  depth,
  collapsed,
  onToggleCollapse,
  onEdit,
  onAddChild,
  onToggleActive,
  onMove,
  onRemove,
}: {
  node: TreeNode;
  siblings: TreeNode[];
  depth: number;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onEdit: (c: AdminCategory) => void;
  onAddChild: (c: AdminCategory) => void;
  onToggleActive: (c: AdminCategory) => void;
  onMove: (node: TreeNode, siblings: TreeNode[], dir: -1 | 1) => void;
  onRemove: (c: AdminCategory) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const idx = siblings.findIndex((s) => s.id === node.id);

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent',
          !node.isActive && 'opacity-60',
        )}
        style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggleCollapse(node.id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Свернуть"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="inline-block w-4" />
        )}

        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{node.name.ru}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{node.slug}</span>
        </span>

        <div className="flex items-center gap-1.5">
          {node._count?.products ? (
            <Badge variant="secondary" className="text-[10px]">
              {node._count.products} тов.
            </Badge>
          ) : null}
          {!node.isActive ? (
            <Badge variant="outline" className="text-[10px] text-amber-600">
              скрыта
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
          <IconBtn title="Вверх" disabled={idx === 0} onClick={() => onMove(node, siblings, -1)}>
            ↑
          </IconBtn>
          <IconBtn
            title="Вниз"
            disabled={idx === siblings.length - 1}
            onClick={() => onMove(node, siblings, 1)}
          >
            ↓
          </IconBtn>
          <IconBtn
            title={node.isActive ? 'Скрыть' : 'Показать'}
            onClick={() => onToggleActive(node)}
          >
            {node.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </IconBtn>
          <IconBtn title="Подкатегория" onClick={() => onAddChild(node)}>
            <Plus className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Изменить" onClick={() => onEdit(node)}>
            <Pencil className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Удалить" onClick={() => onRemove(node)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </IconBtn>
        </div>
      </div>

      {hasChildren && !isCollapsed ? (
        <ul>
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              siblings={node.children}
              depth={depth + 1}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onToggleActive={onToggleActive}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function flattenForSelect(
  nodes: TreeNode[],
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  const out: Array<{ id: string; name: string; depth: number }> = [];
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name.ru, depth });
    out.push(...flattenForSelect(n.children, depth + 1));
  }
  return out;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
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
