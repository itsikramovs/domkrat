'use client';

import { ImageIcon, Loader2, Trash2 } from 'lucide-react';
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
  BANNER_POSITION_LABELS,
  useAdminBanners,
  useAdminCategories,
  useDeleteBanner,
  useSaveBanner,
  uploadBannerImage,
  type AdminBanner,
  type BannerPosition,
} from '@/lib/api/management';

const POSITIONS = Object.keys(BANNER_POSITION_LABELS) as BannerPosition[];

function errMsg(err: unknown): string {
  return err instanceof ApiHttpError ? String(err.body.message) : 'Ошибка';
}

export default function BannersPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const banners = useAdminBanners();
  const categories = useAdminCategories();
  const save = useSaveBanner();
  const del = useDeleteBanner();

  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [titleRu, setTitleRu] = useState('');
  const [titleUz, setTitleUz] = useState('');
  const [subRu, setSubRu] = useState('');
  const [subUz, setSubUz] = useState('');
  const [position, setPosition] = useState<BannerPosition>('HOME_MAIN');
  const [categoryId, setCategoryId] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imgDesktop, setImgDesktop] = useState('');
  const [imgMobile, setImgMobile] = useState('');

  const list = banners.data ?? [];
  const cats = categories.data ?? [];

  function start(b: AdminBanner | null) {
    setEditing(b);
    setTitleRu(b?.title.ru ?? '');
    setTitleUz(b?.title.uz ?? '');
    setSubRu(b?.subtitle?.ru ?? '');
    setSubUz(b?.subtitle?.uz ?? '');
    setPosition(b?.position ?? 'HOME_MAIN');
    setCategoryId(b?.categoryId ?? '');
    setLinkUrl(b?.linkUrl ?? '');
    setSortOrder(String(b?.sortOrder ?? 0));
    setValidFrom((b?.validFrom ?? new Date().toISOString()).slice(0, 10));
    setValidUntil(b?.validUntil ? b.validUntil.slice(0, 10) : '');
    setIsActive(b?.isActive ?? true);
    setImgDesktop(b?.imageUrlDesktop ?? '');
    setImgMobile(b?.imageUrlMobile ?? '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!imgDesktop) {
      toast.error('Загрузите картинку (desktop)');
      return;
    }
    const body: Record<string, unknown> = {
      title: { ru: titleRu, uz: titleUz || titleRu },
      imageUrlDesktop: imgDesktop,
      position,
      sortOrder: Number(sortOrder) || 0,
      isActive,
      validFrom: new Date(validFrom).toISOString(),
      ...(subRu || subUz ? { subtitle: { ru: subRu, uz: subUz } } : {}),
      ...(imgMobile ? { imageUrlMobile: imgMobile } : {}),
      ...(linkUrl ? { linkUrl } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(validUntil ? { validUntil: new Date(validUntil).toISOString() } : {}),
    };
    try {
      await save.mutateAsync({ id: editing?.id, body });
      toast.success(editing ? 'Сохранено' : 'Баннер создан');
      start(null);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить баннер?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Удалено');
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Баннеры</h1>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm font-semibold">
            {editing ? 'Редактирование баннера' : 'Новый баннер'}
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUpload label="Картинка desktop *" value={imgDesktop} onChange={setImgDesktop} />
              <ImageUpload label="Картинка mobile" value={imgMobile} onChange={setImgMobile} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Заголовок (RU) *">
                <Input required value={titleRu} onChange={(e) => setTitleRu(e.target.value)} />
              </Field>
              <Field label="Заголовок (UZ)">
                <Input value={titleUz} onChange={(e) => setTitleUz(e.target.value)} />
              </Field>
              <Field label="Подзаголовок (RU)">
                <Input value={subRu} onChange={(e) => setSubRu(e.target.value)} />
              </Field>
              <Field label="Подзаголовок (UZ)">
                <Input value={subUz} onChange={(e) => setSubUz(e.target.value)} />
              </Field>
              <Field label="Позиция *">
                <Select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as BannerPosition)}
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {BANNER_POSITION_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Категория (для верха категории)">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— нет —</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.ru}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ссылка (URL)">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="/c/brake-system"
                />
              </Field>
              <Field label="Порядок">
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </Field>
              <Field label="Активен с *">
                <Input
                  type="date"
                  required
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </Field>
              <Field label="Активен до">
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </Field>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Активен
                </label>
              </div>
            </div>

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

      {banners.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-2 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.imageUrlDesktop}
                  alt={b.title.ru}
                  className="h-28 w-full rounded-md object-cover"
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.title.ru}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge variant="secondary">{BANNER_POSITION_LABELS[b.position]}</Badge>
                      {b.isActive ? (
                        <Badge variant="outline">активен</Badge>
                      ) : (
                        <Badge variant="destructive">выключен</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      👁 {b.viewCount} · 🖱 {b.clickCount}
                      {b.category ? ` · ${b.category.name.ru}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => start(b)}>
                      Изменить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(b.id)}
                      disabled={del.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Баннеров пока нет</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ImageUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBannerImage(file);
      onChange(url);
      toast.success('Картинка загружена');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            disabled={uploading}
            className="text-xs"
          />
          {uploading ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Загрузка…
            </div>
          ) : null}
          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="block text-xs text-muted-foreground hover:text-destructive"
            >
              Убрать
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
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
