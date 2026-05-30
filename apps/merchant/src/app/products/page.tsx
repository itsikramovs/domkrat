'use client';

import { Check, PackagePlus, Pencil, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { MerchantOfferReceive } from '@/components/merchant-offer-receive';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import {
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

export default function ProductsPage() {
  const offers = useMyOffers();
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const all = offers.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        pickLocale(o.product.name).toLowerCase().includes(q) || o.sku.toLowerCase().includes(q),
    );
  }, [offers.data, search]);

  return (
    <div className="container space-y-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Мои товары</h1>
        <p className="text-sm text-muted-foreground">
          Управление вашими предложениями: цена, остаток и статус. Карточки и контент ведёт
          администратор каталога.
        </p>
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

      {offers.isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Загрузка…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {offers.data && offers.data.length > 0
              ? 'Ничего не найдено.'
              : 'У вас пока нет предложений. Их заводит администратор каталога — обратитесь к нему, чтобы добавить ваши товары.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/50 text-xs">
                  <tr>
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
                    <OfferRow key={o.id} offer={o} />
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

function OfferRow({ offer }: { offer: MyOffer }) {
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
          <td colSpan={5} className="px-4 pb-3">
            <MerchantOfferReceive offerId={offer.id} onDone={() => setReceiving(false)} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
