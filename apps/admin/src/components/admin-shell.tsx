'use client';

import {
  Award,
  Banknote,
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  Contact,
  GalleryHorizontalEnd,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PackagePlus,
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
      { href: '/catalog/products', label: 'Товары', icon: PackageSearch },
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
  {
    title: 'Склад',
    items: [
      { href: '/warehouses', label: 'Склады', icon: Warehouse },
      { href: '/warehouses/receive', label: 'Приёмка партии', icon: PackagePlus },
      { href: '/inventory/count', label: 'Инвентаризация', icon: ClipboardCheck },
    ],
  },
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

/** Текущий пункт меню (для заголовка/хлебных крошек в топбаре) — самое длинное совпадение. */
function currentCrumb(pathname: string): { group: string; label: string } | null {
  let best: { group: string; item: Item } | null = null;
  for (const g of GROUPS) {
    for (const it of g.items) {
      if (isActive(pathname, it.href) && (!best || it.href.length > best.item.href.length)) {
        best = { group: g.title, item: it };
      }
    }
  }
  return best ? { group: best.group, label: best.item.label } : null;
}

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || 'A').trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'A').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
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
  const crumb = currentCrumb(pathname);

  const brand = (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 px-5 py-5"
      onClick={() => setOpen(false)}
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-sm font-black text-white shadow-lg shadow-primary/30">
        DK
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight text-white">Domkrat</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Админ-панель
        </span>
      </span>
    </Link>
  );

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-3">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                  ) : null}
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      active ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300',
                    )}
                  />
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const userFooter = (
    <div className="border-t border-white/5 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-xs font-bold text-white">
          {initials(user?.firstName, user?.email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">
            {user?.firstName ?? user?.email ?? 'Администратор'}
          </div>
          <div className="truncate text-[11px] text-slate-500">{user?.roles?.[0] ?? 'ADMIN'}</div>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            logout();
          }}
          title="Выйти"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const sidebarInner = (
    <>
      {brand}
      {nav}
      {userFooter}
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-slate-950/35 backdrop-blur-xl lg:flex">
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-white/10 bg-slate-950/90 backdrop-blur-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarInner}
          </aside>
        </div>
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-white/5 px-4 backdrop-blur-xl md:px-6">
          <button
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-accent lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Меню"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              {crumb?.group ?? 'Админ'}
            </Link>
            {crumb ? (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-semibold text-foreground">{crumb.label}</span>
              </>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.firstName ?? user?.email}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </header>
        <main className="flex-1 animate-fade-up">{children}</main>
      </div>
    </div>
  );
}
