'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateReview } from '@/lib/api/reviews';
import { ApiHttpError } from '@/lib/api-client';

interface Props {
  productId: string;
  onClose: () => void;
}

export function ReviewForm({ productId, onClose }: Props) {
  const create = useCreateReview();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');

  async function submit() {
    try {
      await create.mutateAsync({
        productId,
        rating,
        title: title || undefined,
        comment: comment || undefined,
        pros: pros || undefined,
        cons: cons || undefined,
      });
      toast.success('Спасибо! Отзыв отправлен на модерацию');
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold">Оставить отзыв</h2>

          <div className="space-y-2">
            <Label>Ваша оценка</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star
                    className={`h-7 w-7 ${n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Заголовок (опц.)</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Комментарий</Label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={5000}
              className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pros">Плюсы</Label>
              <Input id="pros" value={pros} onChange={(e) => setPros(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cons">Минусы</Label>
              <Input id="cons" value={cons} onChange={(e) => setCons(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? 'Отправляем…' : 'Отправить'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
