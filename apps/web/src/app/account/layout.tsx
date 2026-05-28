'use client';

import { Package, RotateCcw, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken === null) router.push(`/login?next=${encodeURIComponent(pathname)}`);
  }, [accessToken, router, pathname]);

  if (!accessToken) return null;

  const links = [
    { href: '/account', label: 'Профиль', icon: User },
    { href: '/account/orders', label: 'Заказы', icon: Package },
    { href: '/account/returns', label: 'Возвраты', icon: RotateCcw },
  ];

  return (
    <div className="container py-8 grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </aside>
      <main>{children}</main>
    </div>
  );
}
