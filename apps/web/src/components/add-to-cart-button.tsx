'use client';

import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAddToCart } from '@/lib/api/cart';
import { ApiHttpError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

interface Props {
  productId: string;
  /** Предложение продавца (маркетплейс). Если задано — добавляем по offerId. */
  offerId?: string;
  /** Компактный режим — только синяя кнопка "+ В корзину" без счётчика (для каталога/каруселей). */
  compact?: boolean;
  disabled?: boolean;
}

export function AddToCartButton({ productId, offerId, compact = false, disabled = false }: Props) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const addToCart = useAddToCart();
  const [qty, setQty] = useState(1);

  const handle = async () => {
    if (!accessToken) {
      toast.info('Войдите чтобы добавить в корзину');
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    try {
      const target = offerId ? { offerId } : { productId };
      await addToCart.mutateAsync({ ...target, quantity: compact ? 1 : qty });
      toast.success('Добавлено в корзину');
    } catch (error) {
      const msg = error instanceof ApiHttpError ? error.body.message : 'Не удалось добавить';
      toast.error(msg);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={addToCart.isPending || disabled}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {addToCart.isPending ? 'Добавляем…' : 'В корзину'}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center rounded-md border">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setQty(Math.max(1, qty - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-sm">{qty}</span>
        <Button type="button" variant="ghost" size="icon" onClick={() => setQty(qty + 1)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <Button size="lg" onClick={handle} disabled={addToCart.isPending || disabled}>
        <ShoppingCart className="mr-2 h-5 w-5" />
        {addToCart.isPending ? 'Добавляем…' : 'В корзину'}
      </Button>
    </div>
  );
}
