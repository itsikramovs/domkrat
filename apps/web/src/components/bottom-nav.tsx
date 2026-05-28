'use client';

import { Grid3x3, Home, Store, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from '@/lib/api/cart';
import { useUnreadCount } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: 'cart' | 'profile';
};

const items: readonly NavItem[] = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/catalog', label: 'Каталог', icon: Grid3x3 },
  { href: '/stores', label: 'Магазины', icon: Store },
  { href: '/cart', label: 'Корзина', icon: ShoppingBag, badge: 'cart' },
  { href: '/account', label: 'Профиль', icon: User, badge: 'profile' },
];

export function BottomNav() {
  const pathname = usePathname();
  const cart = useCart();
  const unread = useUnreadCount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cartCount = cart.data?.itemsCount ?? 0;
  const unreadCount = unread.data?.count ?? 0;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Главное меню"
    >
      <ul className="grid h-16 grid-cols-5">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          const count = badge === 'cart' ? cartCount : badge === 'profile' ? unreadCount : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
                {badge && mounted && count > 0 ? (
                  <span
                    className={cn(
                      'absolute right-[calc(50%-22px)] top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                      badge === 'profile'
                        ? 'bg-sale text-sale-foreground'
                        : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
