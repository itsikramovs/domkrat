import { Heart } from 'lucide-react';

import { EmptyState } from '@/components/empty-state';

export const metadata = { title: 'Избранное' };

export default function FavoritesPage() {
  return (
    <EmptyState
      icon={Heart}
      title="Избранное пусто"
      description="Нажимайте на сердечко рядом с товаром, чтобы добавить его сюда."
      action={{ label: 'Перейти в каталог', href: '/catalog' }}
    />
  );
}
