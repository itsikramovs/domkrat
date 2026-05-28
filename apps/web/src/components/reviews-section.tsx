'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

import { ReviewForm } from '@/components/review-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';
import type { ReviewSummary } from '@/lib/api/reviews-server';

interface Props {
  productId: string;
  productRating: string;
  reviewsCount: number;
  initialReviews: ReviewSummary[];
}

export function ReviewsSection({ productId, productRating, reviewsCount, initialReviews }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [showForm, setShowForm] = useState(false);
  // initialReviews — серверные данные на момент SSR, обновляться будут при перезагрузке

  return (
    <section id="reviews" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Отзывы ({reviewsCount})</h2>
          {Number(productRating) > 0 ? (
            <div className="flex items-center gap-1 text-sm">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-4 w-4 ${n <= Number(productRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                />
              ))}
              <span className="ml-1 text-muted-foreground">{Number(productRating).toFixed(1)}</span>
            </div>
          ) : null}
        </div>
        {accessToken ? (
          <Button variant="outline" onClick={() => setShowForm(true)}>Оставить отзыв</Button>
        ) : (
          <Button asChild variant="outline">
            <a href="/login?next=/p/">Войдите чтобы оставить отзыв</a>
          </Button>
        )}
      </div>

      {initialReviews.length === 0 ? (
        <div className="text-muted-foreground text-sm">
          Отзывов пока нет. Будьте первым после получения заказа!
        </div>
      ) : (
        <div className="space-y-3">
          {initialReviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-4 w-4 ${n <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <div className="font-medium text-sm">
                    {r.user.firstName} {r.user.lastName}
                  </div>
                  {r.isVerifiedPurchase ? (
                    <Badge variant="success" className="text-xs">Verified</Badge>
                  ) : null}
                  <div className="text-xs text-muted-foreground ml-auto">
                    {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                {r.title ? <div className="font-semibold">{r.title}</div> : null}
                {r.comment ? <p className="text-sm">{r.comment}</p> : null}
                {(r.pros || r.cons) ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {r.pros ? (
                      <div>
                        <div className="font-semibold text-green-700">Плюсы</div>
                        <div className="text-muted-foreground">{r.pros}</div>
                      </div>
                    ) : <div />}
                    {r.cons ? (
                      <div>
                        <div className="font-semibold text-red-700">Минусы</div>
                        <div className="text-muted-foreground">{r.cons}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {r.merchantReply ? (
                  <div className="mt-2 pl-3 border-l-2 border-primary text-sm">
                    <div className="font-semibold text-xs text-primary">Ответ продавца</div>
                    <div className="text-muted-foreground">{r.merchantReply}</div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm ? <ReviewForm productId={productId} onClose={() => setShowForm(false)} /> : null}
    </section>
  );
}
