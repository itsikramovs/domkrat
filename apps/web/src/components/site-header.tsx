'use client';

import { LogOut, Search, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from '@/lib/api/cart';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SiteHeader() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const accessToken = useAuthStore((s) => s.accessToken);
  const cart = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const itemsCount = cart.data?.itemsCount ?? 0;

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded bg-primary px-2 py-1 text-sm font-bold text-primary-foreground">DK</span>
          <span className="text-lg font-bold">Домкрат</span>
        </Link>

        <form onSubmit={onSearchSubmit} className="hidden flex-1 md:flex">
          <div className="relative w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по артикулу, OEM или названию"
              className="pl-9"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="relative">
            <Link href="/cart">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Корзина</span>
              {mounted && itemsCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {itemsCount}
                </span>
              ) : null}
            </Link>
          </Button>

          {mounted && accessToken ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/account">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {user?.firstName ?? user?.email ?? 'Аккаунт'}
                  </span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  clear();
                  router.push('/');
                }}
                title="Выйти"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/login">Войти</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
