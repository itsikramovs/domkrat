'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AuthGate } from '@/components/auth-gate';
import { AdminProductForm } from '@/components/admin-product-form';
import { Button } from '@/components/ui/button';
import { useAdminMerchants } from '@/lib/api/admin';
import { useCreateAdminProduct } from '@/lib/api/products';
import { ApiHttpError } from '@/lib/api-client';

export default function NewAdminProductPage() {
  return (
    <AuthGate>
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const router = useRouter();
  const create = useCreateAdminProduct();
  const merchants = useAdminMerchants({ status: 'ACTIVE' });

  return (
    <div className="container max-w-4xl space-y-5 py-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/catalog/products" aria-label="Назад">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Новый товар</h1>
          <p className="text-sm text-white/55">
            Карточка создаётся как черновик. Чтобы товар появился в продаже — оприходуйте его на
            складе.
          </p>
        </div>
      </div>

      <AdminProductForm
        merchants={(merchants.data?.data ?? []).map((m) => ({ id: m.id, brandName: m.brandName }))}
        busy={create.isPending}
        submitLabel="Создать карточку"
        onSubmit={async (body) => {
          try {
            const p = await create.mutateAsync(body);
            toast.success('Карточка создана. Теперь оприходуйте товар.');
            router.push(`/catalog/products/${p.id}`);
          } catch (e) {
            const msg = e instanceof ApiHttpError ? e.body.message : 'Ошибка';
            toast.error(Array.isArray(msg) ? msg.join('; ') : String(msg));
          }
        }}
      />
    </div>
  );
}
