'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ProductForm } from '@/components/product-form';
import { Button } from '@/components/ui/button';
import { useCreateProduct } from '@/lib/api/products';
import { ApiHttpError } from '@/lib/api-client';

export default function NewProductPage() {
  const router = useRouter();
  const create = useCreateProduct();

  return (
    <div className="container py-8 space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/products" aria-label="Назад">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Новый товар</h1>
      </div>
      <ProductForm
        busy={create.isPending}
        submitLabel="Создать товар"
        onSubmit={async (input) => {
          try {
            const product = await create.mutateAsync(input);
            toast.success('Товар создан. Отправлен на модерацию.');
            router.push(`/products/${product.id}`);
          } catch (error) {
            toast.error(error instanceof ApiHttpError ? error.body.message : 'Ошибка');
          }
        }}
      />
    </div>
  );
}
