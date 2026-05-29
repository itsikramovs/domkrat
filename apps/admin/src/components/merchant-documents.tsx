'use client';

import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiHttpError } from '@/lib/api-client';
import { useMerchantDocuments, useReviewMerchantDocument } from '@/lib/api/admin';

const DOC_STATUS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  APPROVED: { label: 'Одобрен', variant: 'success' },
  PENDING: { label: 'На проверке', variant: 'warning' },
  REJECTED: { label: 'Отклонён', variant: 'destructive' },
};

/** Раскрываемая панель KYC-документов мерчанта с одобрением/отклонением. */
export function MerchantDocuments({ merchantId, count }: { merchantId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const docs = useMerchantDocuments(open ? merchantId : null);
  const review = useReviewMerchantDocument(merchantId);

  async function act(docId: string, status: 'APPROVED' | 'REJECTED') {
    const notes =
      status === 'REJECTED'
        ? (prompt('Причина отклонения (необязательно)') ?? undefined)
        : undefined;
    try {
      await review.mutateAsync({ docId, status, notes });
      toast.success(status === 'APPROVED' ? 'Документ одобрен' : 'Документ отклонён');
    } catch (e) {
      toast.error(e instanceof ApiHttpError ? String(e.body.message) : 'Ошибка');
    }
  }

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <FileText className="h-3.5 w-3.5" />
        Документы ({count})
      </button>

      {open ? (
        <div className="mt-2 space-y-2">
          {docs.isLoading ? (
            <p className="text-xs text-muted-foreground">Загрузка…</p>
          ) : !docs.data || docs.data.length === 0 ? (
            <p className="text-xs text-muted-foreground">Документы не загружены.</p>
          ) : (
            docs.data.map((d) => {
              const st = DOC_STATUS[d.status] ?? { label: d.status, variant: 'warning' as const };
              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.documentType}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {d.fileName}
                    </a>
                    {d.reviewNotes ? (
                      <div className="text-muted-foreground">{d.reviewNotes}</div>
                    ) : null}
                  </div>
                  {d.status === 'PENDING' ? (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => act(d.id, 'APPROVED')}
                        disabled={review.isPending}
                      >
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(d.id, 'REJECTED')}
                        disabled={review.isPending}
                      >
                        Отклонить
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
