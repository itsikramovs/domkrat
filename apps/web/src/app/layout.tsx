import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';

import { BottomNav } from '@/components/bottom-nav';
import { QueryProvider } from '@/lib/query-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Домкрат — маркетплейс автотоваров', template: '%s · Домкрат' },
  description: 'Запчасти и автотовары для Узбекистана: оригиналы и аналоги, доставка по Ташкенту.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d6cf5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col">
        <QueryProvider>
          <SiteHeader />
          {/* pb-20 на мобильном резервирует место под BottomNav */}
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <div className="hidden md:block">
            <SiteFooter />
          </div>
          <BottomNav />
        </QueryProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
