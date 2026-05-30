'use client';

import { Check, PackageCheck, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { OfferReceivePanel } from '@/components/offer-receive-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiHttpError } from '@/lib/api-client';
import { useAdminMerchants } from '@/lib/api/admin';
import {
  useCreateOffer,
  useDeleteOffer,
  useSetOfferStatus,
  useUpdateOffer,
  type AdminOffer,
  type AdminVariant,
} from '@/lib/api/products';
import { formatPrice } from '@/lib/utils';

function err(e: unknown) {
  return e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка';
}

const OFFER_STATUS: Record<string, { label: string; variant: 'success' | 'secondary' }> = {
  ACTIVE: { label: 'Активно', variant: 'success' },
  INACTIVE: { label: 'Выключено', variant: 'secondary' },
  OUT_OF_STOCK: { label: 'Нет в наличии', variant: 'secondary' },
};

/** Предложения продавцов по карточке, сгруппированные по вариантам (мультипродавец). */
export function OffersManager({
  productId,
  variants,
  offers,
}: {
  productId: string;
  variants: AdminVariant[];
  offers: AdminOffer[];
}) {
  const [addingFor, setAddingFor] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Store className="h-4 w-4" /> Предложения продавцов
          </h2>
          <span className="text-xs text-muted-foreground">{offers.length} шт.</span>
        </div>

        {variants.map((v) => {
          const variantOffers = offers.filter((o) => o.variantId === v.id);
          return (
            <div key={v.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  {v.name?.ru ?? 'Базовый вариант'}
                  {v.isDefault ? (
                    <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      основной
                    </span>
                  ) : null}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddingFor(addingFor === v.id ? null : v.id)}
                >
                  <Plus className="h-3.5 w-3.5" /> Предложение
                </Button>
              </div>

              {variantOffers.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Нет предложений. Добавьте продавца с ценой и оприходуйте остаток.
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-card/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Продавец</th>
                        <th className="px-3 py-2 text-left font-medium">SKU</th>
                        <th className="px-3 py-2 text-right font-medium">Цена</th>
                        <th className="px-3 py-2 text-right font-medium">Остаток</th>
                        <th className="px-3 py-2 text-left font-medium">Статус</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {variantOffers.map((o) => (
                        <OfferRow key={o.id} productId={productId} offer={o} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {addingFor === v.id ? (
                <AddOfferForm
                  productId={productId}
                  variantId={v.id}
                  onClose={() => setAddingFor(null)}
                />
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function OfferRow({ productId, offer }: { productId: string; offer: AdminOffer }) {
  const update = useUpdateOffer(productId);
  const setStatus = useSetOfferStatus(productId);
  const remove = useDeleteOffer(productId);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(offer.price);
  const [receiving, setReceiving] = useState(false);
  const st = OFFER_STATUS[offer.status] ?? { label: offer.status, variant: 'secondary' as const };

  async function savePrice() {
    try {
      await update.mutateAsync({ offerId: offer.id, body: { price: Number(price) } });
      setEditing(false);
      toast.success('Цена обновлена');
    } catch (e) {
      toast.error(err(e));
    }
  }

  return (
    <>
      <tr className="border-t border-border">
        <td className="px-3 py-2 text-foreground">{offer.merchant.brandName}</td>
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{offer.sku}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {editing ? (
            <span className="flex items-center justify-end gap-1">
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-8 w-28 text-right"
                autoFocus
              />
              <button className="text-emerald-400" title="Сохранить" onClick={savePrice}>
                <Check className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <button
              className="hover:underline"
              onClick={() => setEditing(true)}
              title="Изменить цену"
            >
              {formatPrice(offer.price)}
            </button>
          )}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-foreground">{offer.stock}</td>
        <td className="px-3 py-2">
          <Badge variant={st.variant}>{st.label}</Badge>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-2">
            <button
              title="Принять на склад"
              className="text-muted-foreground hover:text-primary"
              onClick={() => setReceiving((r) => !r)}
            >
              <PackageCheck className="h-4 w-4" />
            </button>
            <button
              title={offer.status === 'ACTIVE' ? 'Выключить' : 'Включить'}
              className="text-muted-foreground hover:text-amber-300"
              onClick={() =>
                setStatus.mutate({
                  offerId: offer.id,
                  status: offer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                })
              }
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              title="Удалить"
              className="text-muted-foreground hover:text-red-400"
              onClick={async () => {
                try {
                  await remove.mutateAsync(offer.id);
                  toast.success('Предложение удалено');
                } catch (e) {
                  toast.error(err(e));
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {receiving ? (
        <tr>
          <td colSpan={6} className="px-3 pb-3">
            <OfferReceivePanel
              productId={productId}
              offerId={offer.id}
              merchantId={offer.merchantId}
              onDone={() => setReceiving(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AddOfferForm({
  productId,
  variantId,
  onClose,
}: {
  productId: string;
  variantId: string;
  onClose: () => void;
}) {
  const merchants = useAdminMerchants({ status: 'ACTIVE' });
  const create = useCreateOffer(productId);
  const [merchantId, setMerchantId] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [vatRate, setVatRate] = useState('12');

  async function submit() {
    if (!merchantId || !sku.trim() || !price) {
      toast.error('Заполните продавца, SKU и цену');
      return;
    }
    try {
      await create.mutateAsync({
        variantId,
        merchantId,
        sku: sku.trim(),
        price: Number(price),
        vatRate: Number(vatRate) || 12,
      });
      toast.success('Предложение добавлено');
      onClose();
    } catch (e) {
      toast.error(err(e));
    }
  }

  return (
    <div className="grid gap-2 rounded-md border border-border bg-card/40 p-3 sm:grid-cols-[1.4fr_1fr_0.8fr_0.6fr_auto]">
      <select
        className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        value={merchantId}
        onChange={(e) => setMerchantId(e.target.value)}
      >
        <option value="">— продавец —</option>
        {(merchants.data?.data ?? []).map((m) => (
          <option key={m.id} value={m.id}>
            {m.brandName}
          </option>
        ))}
      </select>
      <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
      <Input
        type="number"
        placeholder="Цена"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="tabular-nums"
      />
      <Input
        type="number"
        placeholder="НДС %"
        value={vatRate}
        onChange={(e) => setVatRate(e.target.value)}
        className="tabular-nums"
      />
      <div className="flex gap-1">
        <Button size="sm" onClick={submit} disabled={create.isPending}>
          Добавить
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
