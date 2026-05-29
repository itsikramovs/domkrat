'use client';

import { Boxes, Layers, LogOut, Package, PackagePlus, Store, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';

export function MerchantHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nav = [
    { href: '/dashboard', label: 'Дашборд', icon: Store },
    { href: '/products', label: 'Товары', icon: Boxes },
    { href: '/orders', label: 'Заказы', icon: Package },
    { href: '/warehouses', label: 'Склады', icon: Warehouse },
    { href: '/receipts', label: 'Приёмки', icon: PackagePlus },
    { href: '/inventory', label: 'Остатки', icon: Layers },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="rounded-lg bg-brand-gradient px-2 py-1 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25">
            DK
          </span>
          <span className="text-lg font-bold tracking-tight">Merchant</span>
        </Link>

        {mounted && user ? (
          <nav className="flex items-center gap-1">
            {nav.map((l) => {
              const Icon = l.icon;
              const active = pathname.startsWith(l.href);
              return (
                <Button key={l.href} asChild variant={active ? 'default' : 'ghost'} size="sm">
                  <Link href={l.href}>
                    <Icon className="h-4 w-4" />
                    {l.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {mounted && user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.firstName ?? user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  clear();
                  router.push('/login');
                }}
                title="Выйти"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Выйти</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
