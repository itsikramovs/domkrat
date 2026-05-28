'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateReturn, type CreateReturnInput } from '@/lib/api/returns';
import { ApiHttpError } from '@/lib/api-client';
import { pickLocale } from '@/lib/utils';

interface Props {
  orderId: string;
  items: Array<{
    id: string;
    quantity: number;
    productSnapshot: { sku: string; name: { ru: string; uz: string } };
  }>;
  onClose: () => void;
}

const REASONS: Array<{ value: CreateReturnInput['reason']; label: string }> = [
  { value: 'DEFECTIVE', label: 'Брак' },
  { value: 'WRONG_ITEM', label: 'Не тот товар' },
  { value: 'NOT_FITTING', label: 'Не подошло (не та модель)' },
  { value: 'CHANGED_MIND', label: 'Передумал' },
  { value: 'DAMAGED_IN_TRANSIT', label: 'Повреждено при доставке' },
  { value: 'OTHER', label: 'Другое' },
];

export function ReturnDialog({ orderId, items, onClose }: Props) {
  const router = useRouter();
  const create = useCreateReturn();
  const [reason, setReason] = useState<CreateReturnInput['reason']>('NOT_FITTING');
  const [desc, setDesc] = useState('');
  const [pickup, setPickup] = useState<CreateReturnInput['pickupMethod']>('CUSTOMER_BRING');
  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, 0])),
  );

  async function submit() {
    const selected = items
      .map((i) => ({ orderItemId: i.id, quantity: qtys[i.id] ?? 0 }))
      .filter((i) => i.quantity > 0);

    if (selected.length === 0) {
      toast.error('Выберите хотя бы одну позицию');
      return;
    }
    try {
      await create.mutateAsync({
        orderId,
        reason,
        reasonDescription: desc || undefined,
        pickupMethod: pickup,
        items: selected,
      });
      toast.success('Заявка на возврат создана');
      onClose();
      router.push('/account/returns');
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold">Возврат заказа</h2>

          <div className="space-y-2">
            <Label>Позиции для возврата</Label>
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-2 border rounded">
                <div className="flex-1 text-sm">
                  <div className="font-medium">{pickLocale(i.productSnapshot.name)}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {i.productSnapshot.sku} · заказано: {i.quantity}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={i.quantity}
                  value={qtys[i.id] ?? 0}
                  onChange={(e) => setQtys({ ...qtys, [i.id]: Math.min(i.quantity, Math.max(0, Number(e.target.value))) })}
                  className="w-20"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Причина</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as CreateReturnInput['reason'])}
            >
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Комментарий</Label>
            <Input id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Опишите проблему (опц.)" />
          </div>

          <div className="space-y-2">
            <Label>Как вернёте?</Label>
            <div className="space-y-2">
              {([['CUSTOMER_BRING', 'Привезу в пункт выдачи'], ['COURIER_PICKUP', 'Заберёт курьер']] as const).map(
                ([v, l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="pickup" value={v} checked={pickup === v} onChange={() => setPickup(v)} />
                    <span className="text-sm">{l}</span>
                  </label>
                ),
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? 'Создаём…' : 'Подать заявку'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
