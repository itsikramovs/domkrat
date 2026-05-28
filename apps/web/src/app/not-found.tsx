import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container max-w-md py-16 text-center space-y-6">
      <div className="text-7xl font-extrabold text-primary">404</div>
      <h1 className="text-2xl font-bold">Страница не найдена</h1>
      <p className="text-muted-foreground">
        Возможно, ссылка устарела или товар был снят с продажи.
      </p>
      <div className="flex gap-2 justify-center">
        <Button asChild>
          <Link href="/">На главную</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/catalog">В каталог</Link>
        </Button>
      </div>
    </div>
  );
}
