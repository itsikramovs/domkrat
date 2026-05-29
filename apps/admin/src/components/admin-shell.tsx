'use client';

import {
  Award,
  Banknote,
  BarChart3,
  Contact,
  GalleryHorizontalEnd,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PackageSearch,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tags,
  Ticket,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: LucideIcon };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: 'Обзор',
    items: [
      { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
      { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
    ],
  },
  {
    title: 'Каталог',
    items: [
      { href: '/catalog/products', label: 'Модерация товаров', icon: PackageSearch },
      { href: '/catalog/categories', label: 'Категории', icon: Tags },
      { href: '/catalog/brands', label: 'Бренды', icon: Award },
      { href: '/attributes', label: 'Характеристики', icon: ListChecks },
    ],
  },
  {
    title: 'Продажи',
    items: [
      { href: '/orders', label: 'Заказы', icon: ShoppingBag },
      { href: '/returns', label: 'Возвраты', icon: RotateCcw },
      { href: '/reviews', label: 'Отзывы', icon: Star },
    ],
  },
  {
    title: 'Партнёры',
    items: [
      { href: '/merchants', label: 'Мерчанты', icon: ShieldCheck },
      { href: '/customers', label: 'Клиенты', icon: Contact },
      { href: '/users', label: 'Пользователи', icon: Users },
    ],
  },
  {
    title: 'Маркетинг',
    items: [
      { href: '/banners', label: 'Баннеры', icon: GalleryHorizontalEnd },
      { href: '/monetization', label: 'Монетизация', icon: Ticket },
    ],
  },
  { title: 'Склад', items: [{ href: '/warehouses', label: 'Склады', icon: Warehouse }] },
  {
    title: 'Финансы',
    items: [
      { href: '/finance', label: 'Сводка', icon: Wallet },
      { href: '/finance/withdrawals', label: 'Выводы средств', icon: Banknote },
    ],
  },
  {
    title: 'Система',
    items: [
      { href: '/staff', label: 'Сотрудники', icon: UserCog },
      { href: '/system', label: 'Настройки', icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const [open, setOpen] = useState(false);

  // Страница логина — без админского хрома
  if (pathname === '/login') return <>{children}</>;

  const logout = () => {
    clear();
    router.push('/login');
  };

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {g.title}
          </div>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="border-t border-slate-800 pt-3">
        <button
          onClick={() => {
            setOpen(false);
            logout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Выйти из админки
        </button>
      </div>
    </nav>
  );

  const brand = (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-5 py-4"
      onClick={() => setOpen(false)}
    >
      <span className="rounded-lg bg-brand-gradient px-2 py-1 text-sm font-bold text-white shadow-sm shadow-primary/25">
        DK
      </span>
      <span className="text-lg font-bold tracking-tight text-white">Admin</span>
    </Link>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-900 lg:flex">
        {brand}
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-slate-900">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button onClick={() => setOpen(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Меню">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-muted-foreground lg:hidden">
            Domkrat Admin
          </span>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.firstName ?? user.email}
              </span>
            ) : null}
            <button
              onClick={() => {
                clear();
                router.push('/login');
              }}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
