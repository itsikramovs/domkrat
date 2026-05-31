'use client';

import { Check, Download, PackagePlus, Pencil, Search, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { MerchantOfferReceive } from '@/components/merchant-offer-receive';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import {
  useBulkOffers,
  useExportOffers,
  useImportOffers,
  useMyOffers,
  useSetMyOfferStatus,
  useUpdateMyOffer,
  type MyOffer,
  type OfferStatus,
} from '@/lib/api/offers';
import { formatPrice, pickLocale } from '@/lib/utils';

const STATUS: Record<OfferStatus, { label: string; variant: 'success' | 'secondary' }> = {
  ACTIVE: { label: 'Активно', variant: 'success' },
  INACTIVE: { label: 'Выключено', variant: 'secondary' },
  OUT_OF_STOCK: { label: 'Нет в наличии', variant: 'secondary' },
};

const TABS: Array<{ key: 'ALL' | OfferStatus; label: string }> = [
  { key: 'ALL', label: 'Все' },
  { key: 'ACTIVE', label: 'Активные' },
  { key: 'INACTIVE', label: 'Выключенные' },
  { key: 'OUT_OF_STOCK', label: 'Нет в наличии' },
];

export default function ProductsPage() {
  const offers = useMyOffers();
  const exportM = useExportOffers();
  const importM = useImportOffers();
  const bulk = useBulkOffers();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | OfferStatus>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');

  const all = offers.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all.length };
    for (const o of all) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [all]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((o) => {
      if (tab !== 'ALL' && o.status !== tab) return false;
      if (!q) return true;
      return (
        pickLocale(o.product.name).toLowerCase().includes(q) || o.sku.toLowerCase().includes(q)
      );
    });
  }, [all, search, tab]);

  const allSelected = list.length > 0 && list.every((o) => selected.has(o.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      if (list.every((o) => s.has(o.id))) {
        const n = new Set(s);
        list.forEach((o) => n.delete(o.id));
        return n;
      }
      const n = new Set(s);
      list.forEach((o) => n.add(o.id));
      return n;
    });

  async function doExport() {
    try {
      const { csv, filename } = await exportM.mutateAsync();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка экспорта');
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      const res = await importM.mutateAsync(text);
      toast.success(`Импорт: обновлено ${res.updated}, пропущено ${res.skipped}`);
      if (res.errors.length) toast.warning(res.errors.slice(0, 3).join('; '));
    } catch (e2) {
      toast.error(e2 instanceof ApiHttpError ? String(e2.body.message) : 'Ошибка импорта');
    }
  }

  async function bulkSet(patch: { status?: OfferStatus; price?: number }) {
    try {
      const res = await bulk.mutateAsync({ offerIds: [...selected], ...patch });
      toast.success(`Обновлено предложений: ${res.updated}`);
      setSelected(new Set());
      setBulkPrice('');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container space-y-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Мои товары</h1>
          <p className="text-sm text-muted-foreground">
            Управление предложениями: цена, остаток, статус. Массовые операции и прайс-лист
            (CSV/Excel). Карточки ведёт администратор каталога.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport} disabled={exportM.isPending}>
            <Download className="mr-1 h-4 w-4" /> Экспорт CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importM.isPending}
          >
            <Upload className="mr-1 h-4 w-4" /> Импорт CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            {t.label} {counts[t.key] ? `(${counts[t.key]})` : ''}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {selected.size > 0 ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="font-medium">Выбрано: {selected.size}</span>
            <span className="text-muted-foreground">Статус:</span>
            {(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'] as OfferStatus[]).map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => bulkSet({ status: s })}>
                {STATUS[s].label}
              </Button>
            ))}
            <span className="ml-2 text-muted-foreground">Цена всем:</span>
            <Input
              type="number"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              placeholder="сумма"
              className="h-8 w-28 tabular-nums"
            />
            <Button
              size="sm"
              onClick={() => bulkSet({ price: Number(bulkPrice) })}
              disabled={!bulkPrice || Number(bulkPrice) <= 0 || bulk.isPending}
            >
              Применить
            </Button>
            <button
              className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-4 w-4" /> снять
            </button>
          </CardContent>
        </Card>
      ) : null}

      {offers.isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Загрузка…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {all.length > 0
              ? 'Ничего не найдено.'
              : 'У вас пока нет предложений. Их заводит администратор каталога — обратитесь к нему.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Товар</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Цена</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Остаток
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((o) => (
                    <OfferRow
                      key={o.id}
                      offer={o}
                      selected={selected.has(o.id)}
                      onToggle={() => toggle(o.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  selected,
  onToggle,
}: {
  offer: MyOffer;
  selected: boolean;
  onToggle: () => void;
}) {
  const update = useUpdateMyOffer();
  const setStatus = useSetMyOfferStatus();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(offer.price);
  const [receiving, setReceiving] = useState(false);
  const st = STATUS[offer.status] ?? { label: offer.status, variant: 'secondary' as const };
  const img = offer.product.images?.[0]?.thumbnailUrl ?? offer.product.images?.[0]?.url ?? null;
  const variantLabel = offer.variant.name ? pickLocale(offer.variant.name) : null;

  async function savePrice() {
    try {
      await update.mutateAsync({ id: offer.id, body: { price: Number(price) } });
      setEditing(false);
      toast.success('Цена обновлена');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <>
      <tr className="align-top hover:bg-muted/30">
        <td className="px-3 py-3">
          <input type="checkbox" checked={selected} onChange={onToggle} />
        </td>
        <td className="px-4 py-3">
          <Link
            href={`/p/${offer.product.slug}`}
            className="flex items-start gap-3"
            target="_blank"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-full w-full object-cover" />
              ) : (
                <PackagePlus className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-medium leading-tight line-clamp-2">
                {pickLocale(offer.product.name)}
              </span>
              {variantLabel ? (
                <span className="text-xs text-muted-foreground">Вариант: {variantLabel}</span>
              ) : null}
            </span>
          </Link>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{offer.sku}</td>
        <td className="px-4 py-3 text-right tabular-nums">
          {editing ? (
            <span className="flex items-center justify-end gap-1">
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-8 w-28 text-right"
                autoFocus
              />
              <button className="text-emerald-600" title="Сохранить" onClick={savePrice}>
                <Check className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <button
              className="inline-flex items-center gap-1 font-semibold hover:text-primary"
              onClick={() => setEditing(true)}
              title="Изменить цену"
            >
              {formatPrice(offer.price)}
              <Pencil className="h-3 w-3 opacity-60" />
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="tabular-nums font-medium">{offer.stock}</span>
            <Button size="sm" variant="outline" onClick={() => setReceiving((r) => !r)}>
              Принять
            </Button>
          </div>
        </td>
        <td className="px-4 py-3">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            value={offer.status}
            onChange={(e) =>
              setStatus.mutate({ id: offer.id, status: e.target.value as OfferStatus })
            }
            disabled={setStatus.isPending}
          >
            <option value="ACTIVE">Активно</option>
            <option value="INACTIVE">Выключено</option>
            <option value="OUT_OF_STOCK">Нет в наличии</option>
          </select>
          <div className="mt-1">
            <Badge variant={st.variant} className="text-[10px]">
              {offer.product.status === 'ACTIVE' ? 'карточка активна' : 'карточка на модерации'}
            </Badge>
          </div>
        </td>
      </tr>
      {receiving ? (
        <tr>
          <td colSpan={6} className="px-4 pb-3">
            <MerchantOfferReceive offerId={offer.id} onDone={() => setReceiving(false)} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
