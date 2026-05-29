'use client';

import { Bell, Car, Heart, LogOut, MapPin, Package, RotateCcw, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useUnreadCount } from '@/lib/api/notifications';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    // редиректим только ПОСЛЕ регидрации persist — иначе F5 выбрасывает на /login
    if (hasHydrated && !accessToken) router.push(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hasHydrated, accessToken, router, pathname]);

  if (!hasHydrated || !accessToken) return null;

  return <AccountShell pathname={pathname}>{children}</AccountShell>;
}

function AccountShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const unread = useUnreadCount();
  const unreadCount = unread.data?.count ?? 0;

  function logout() {
    clear();
    router.push('/');
  }

  const links = [
    { href: '/account', label: 'Профиль', icon: User, exact: true },
    { href: '/account/orders', label: 'Заказы', icon: Package },
    { href: '/account/notifications', label: 'Уведомления', icon: Bell, badge: unreadCount },
    { href: '/account/favorites', label: 'Избранное', icon: Heart },
    { href: '/account/returns', label: 'Возвраты', icon: RotateCcw },
    { href: '/account/addresses', label: 'Адреса', icon: MapPin },
    { href: '/account/garage', label: 'Гараж', icon: Car },
  ];

  return (
    <div className="md:container md:py-8 md:grid md:gap-6 md:[grid-template-columns:220px_1fr]">
      <aside className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto border-b px-4 py-2 md:mx-0 md:flex-col md:gap-1 md:border-0 md:px-0 md:py-0">
        {links.map((l) => {
          const Icon = l.icon;
          const active = l.exact
            ? pathname === l.href
            : pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors md:rounded-md md:px-3 md:py-2',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-accent md:bg-transparent md:hover:bg-accent',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{l.label}</span>
              {l.badge ? (
                <span
                  className={cn(
                    'ml-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                    active ? 'bg-white/20 text-current' : 'bg-sale text-sale-foreground',
                  )}
                >
                  {l.badge > 99 ? '99+' : l.badge}
                </span>
              ) : null}
            </Link>
          );
        })}

        {/* Выход — отдельная кнопка, видимая и на мобильном (горизонтальный скролл), и на десктопе */}
        <button
          type="button"
          onClick={logout}
          className="flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 md:mt-2 md:rounded-md md:border-t md:border-transparent"
        >
          <LogOut className="h-4 w-4" />
          <span className="whitespace-nowrap">Выйти</span>
        </button>
      </aside>
      <main>{children}</main>
    </div>
  );
}
