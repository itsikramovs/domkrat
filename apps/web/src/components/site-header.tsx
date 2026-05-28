'use client';

import { Heart, LogOut, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SearchAutocomplete } from '@/components/search-autocomplete';
import { useCart } from '@/lib/api/cart';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

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

  const submitSearch = () => {
    const q = search.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {/* Desktop row */}
      <div className="container hidden h-16 items-center gap-4 md:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded-md bg-primary px-2 py-1 text-sm font-bold text-primary-foreground">DK</span>
          <span className="text-lg font-bold">Домкрат</span>
        </Link>

        <div className="flex flex-1 justify-center">
          <div className="w-full max-w-2xl">
            <SearchAutocomplete
              value={search}
              onChange={setSearch}
              onSubmit={submitSearch}
              position="desktop"
            />
          </div>
        </div>

        <nav className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="relative">
            <Link href="/cart" aria-label="Корзина">
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
                  <span className="hidden sm:inline">{user?.firstName ?? user?.email ?? 'Аккаунт'}</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  clear();
                  router.push('/');
                }}
                aria-label="Выйти"
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

      {/* Mobile sticky search */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex-1">
            <SearchAutocomplete
              value={search}
              onChange={setSearch}
              onSubmit={submitSearch}
              position="mobile"
            />
          </div>
          <Link
            href="/account/favorites"
            aria-label="Избранное"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
          >
            <Heart className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
