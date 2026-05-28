import { Heart } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Избранное' };

export default function FavoritesPage() {
  return (
    <div className="space-y-4 px-4 py-12 text-center md:container">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
        <Heart className="h-9 w-9 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold md:text-2xl">Избранное пусто</h1>
      <p className="text-sm text-muted-foreground">
        Нажимайте на сердечко рядом с товаром, чтобы добавить его сюда.
      </p>
      <Link
        href="/"
        className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Перейти в каталог
      </Link>
    </div>
  );
}
