'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app/error.tsx]', error);
  }, [error]);

  return (
    <div className="container max-w-md py-16 text-center space-y-6">
      <div className="text-6xl">⚠️</div>
      <h1 className="text-2xl font-bold">Что-то пошло не так</h1>
      <p className="text-muted-foreground">
        Произошла непредвиденная ошибка. Мы уже знаем о проблеме — попробуйте ещё раз.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/60 font-mono">ID ошибки: {error.digest}</p>
      ) : null}
      <div className="flex gap-2 justify-center">
        <Button onClick={reset}>Повторить</Button>
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
