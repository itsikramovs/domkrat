'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminReviews, useModerateReview } from '@/lib/api/management';
import { ApiHttpError } from '@/lib/api-client';

const TABS = ['PENDING', 'APPROVED', 'REJECTED'];

export default function ReviewsPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const [status, setStatus] = useState('PENDING');
  const reviews = useAdminReviews(status);
  const moderate = useModerateReview();
  const list = reviews.data?.data ?? [];

  async function act(id: string, s: 'APPROVED' | 'REJECTED') {
    try {
      await moderate.mutateAsync({ id, status: s });
      toast.success(s === 'APPROVED' ? 'Одобрено' : 'Отклонено');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Отзывы</h1>
      <div className="flex gap-2 text-sm">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded border px-3 py-1 ${status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {reviews.isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">Отзывов нет</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-warning">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-warning' : ''}`}
                          />
                        ))}
                      </span>
                      <Badge variant="outline">{r.product?.sku}</Badge>
                    </div>
                    {r.title ? <div className="font-medium">{r.title}</div> : null}
                    <div className="text-sm text-muted-foreground">{r.body}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.user?.firstName} {r.user?.lastName} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString('ru')}
                    </div>
                  </div>
                  {status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => act(r.id, 'APPROVED')}
                        disabled={moderate.isPending}
                      >
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(r.id, 'REJECTED')}
                        disabled={moderate.isPending}
                      >
                        Отклонить
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
