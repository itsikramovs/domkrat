'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AddressForm } from '@/components/address-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/lib/api/cart';
import { useCreateOrder, usePayOrder, type CreateOrderInput } from '@/lib/api/orders';
import { useAddresses, useCreateAddress } from '@/lib/api/users';
import { ApiHttpError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { formatPrice, pickLocale } from '@/lib/utils';

const DELIVERY_METHODS: Array<{
  value: CreateOrderInput['deliveryMethod'];
  label: string;
  hint: string;
  cost: string;
}> = [
  { value: 'SELF_PICKUP', label: 'Самовывоз', hint: 'Главный склад Ташкент', cost: 'бесплатно' },
  {
    value: 'PLATFORM_COURIER',
    label: 'Курьер по Ташкенту',
    hint: 'Доставка за 1 день',
    cost: '25 000 сум',
  },
];

const PAYMENT_METHODS: Array<{
  value: CreateOrderInput['paymentMethod'];
  label: string;
  hint: string;
}> = [
  { value: 'MOCK', label: 'Тестовая оплата (MOCK)', hint: 'Авто-успех — для проверки flow' },
  { value: 'COD', label: 'Наличными курьеру', hint: 'Оплата при получении' },
  { value: 'CLICK', label: 'Click', hint: 'Не подключён в MVP — 501' },
  { value: 'PAYME', label: 'Payme', hint: 'Не подключён в MVP — 501' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const cart = useCart();
  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();

  const [deliveryMethod, setDeliveryMethod] =
    useState<CreateOrderInput['deliveryMethod']>('PLATFORM_COURIER');
  const [paymentMethod, setPaymentMethod] = useState<CreateOrderInput['paymentMethod']>('MOCK');
  const [addressId, setAddressId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);

  useEffect(() => {
    // редиректим только ПОСЛЕ регидрации persist — иначе F5 выбрасывает на /login
    if (hasHydrated && !accessToken) router.push('/login?next=/checkout');
  }, [hasHydrated, accessToken, router]);

  useEffect(() => {
    if (addresses.data && !addressId) {
      const def = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];
      if (def) setAddressId(def.id);
    }
  }, [addresses.data, addressId]);

  if (!hasHydrated || !accessToken) return null;
  if (cart.isLoading || addresses.isLoading) {
    return <div className="container py-12 text-center text-muted-foreground">Загрузка…</div>;
  }
  if (!cart.data || cart.data.items.length === 0) {
    return (
      <div className="container py-12 text-center space-y-4">
        <p className="text-muted-foreground">Корзина пуста</p>
        <Button onClick={() => router.push('/')}>В каталог</Button>
      </div>
    );
  }

  async function submit() {
    if (deliveryMethod !== 'SELF_PICKUP' && !addressId) {
      toast.error('Выберите адрес доставки');
      return;
    }
    try {
      const input: CreateOrderInput = {
        deliveryMethod,
        paymentMethod,
        customerNotes: notes || undefined,
        deliveryAddressId: deliveryMethod === 'SELF_PICKUP' ? undefined : addressId,
      };
      const order = await createOrder.mutateAsync(input);

      // Initiate payment immediately for MOCK/COD
      try {
        await payOrder.mutateAsync(order.id);
        toast.success('Заказ оплачен!');
      } catch (error) {
        const msg = error instanceof ApiHttpError ? error.body.message : 'Платёж не прошёл';
        toast.warning(`Заказ создан, но оплата не прошла: ${msg}`);
      }

      router.push(`/account/orders/${order.id}`);
    } catch (error) {
      const msg = error instanceof ApiHttpError ? error.body.message : 'Ошибка оформления';
      toast.error(msg);
    }
  }

  const isSubmitting = createOrder.isPending || payOrder.isPending;
  const total = Number(cart.data.pricing.total);
  const deliveryCost = deliveryMethod === 'SELF_PICKUP' ? 0 : 25000;

  return (
    <div className="container py-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Оформление заказа</h1>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Способ доставки</h2>
            {DELIVERY_METHODS.map((m) => (
              <label
                key={m.value}
                className="flex items-start gap-3 cursor-pointer p-3 rounded border hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent/50"
              >
                <input
                  type="radio"
                  name="delivery"
                  value={m.value}
                  checked={deliveryMethod === m.value}
                  onChange={() => setDeliveryMethod(m.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.hint}</div>
                </div>
                <div className="text-sm">{m.cost}</div>
              </label>
            ))}
          </CardContent>
        </Card>

        {deliveryMethod !== 'SELF_PICKUP' ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Адрес доставки</h2>
                {!addingAddress && addresses.data && addresses.data.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAddingAddress(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <Plus className="h-3 w-3" />
                    Новый адрес
                  </button>
                ) : null}
              </div>

              {!addingAddress && addresses.data && addresses.data.length > 0
                ? addresses.data.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-start gap-3 cursor-pointer p-3 rounded border hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent/50"
                    >
                      <input
                        type="radio"
                        name="address"
                        value={a.id}
                        checked={addressId === a.id}
                        onChange={() => setAddressId(a.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">
                          {a.title ? `${a.title} · ` : ''}
                          {a.recipientName}
                        </div>
                        <div className="text-muted-foreground">
                          {a.city}, {a.addressLine}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.recipientPhone}</div>
                      </div>
                    </label>
                  ))
                : null}

              {addingAddress || (addresses.data && addresses.data.length === 0) ? (
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <AddressForm
                    busy={createAddress.isPending}
                    submitLabel="Сохранить и выбрать"
                    onCancel={
                      addresses.data && addresses.data.length > 0
                        ? () => setAddingAddress(false)
                        : undefined
                    }
                    onSubmit={async (input) => {
                      try {
                        const created = await createAddress.mutateAsync({
                          ...input,
                          isDefault: input.isDefault ?? addresses.data?.length === 0,
                        });
                        setAddressId(created.id);
                        setAddingAddress(false);
                        toast.success('Адрес добавлен');
                      } catch (error) {
                        toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
                      }
                    }}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Оплата</h2>
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m.value}
                className="flex items-start gap-3 cursor-pointer p-3 rounded border hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent/50"
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.value}
                  checked={paymentMethod === m.value}
                  onChange={() => setPaymentMethod(m.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.hint}</div>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3">
            <Label htmlFor="notes">Комментарий к заказу</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Например: позвонить за час до доставки"
            />
          </CardContent>
        </Card>
      </div>

      <aside>
        <Card className="sticky top-20">
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Ваш заказ</h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {cart.data.items.map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className="truncate flex-1">
                    {pickLocale(i.product.name)} × {i.quantity}
                  </span>
                  <span className="ml-2 whitespace-nowrap">
                    {formatPrice(Number(i.product.price) * i.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Товары</span>
                <span>{formatPrice(cart.data.pricing.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Доставка</span>
                <span>{formatPrice(deliveryCost)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2">
                <span>К оплате</span>
                <span>{formatPrice(total + deliveryCost)}</span>
              </div>
            </div>

            <Button size="lg" className="w-full" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? 'Оформляем…' : 'Подтвердить и оплатить'}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
