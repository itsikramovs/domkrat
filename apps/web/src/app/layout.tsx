import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { QueryProvider } from '@/lib/query-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Домкрат — маркетплейс автотоваров', template: '%s · Домкрат' },
  description: 'Запчасти и автотовары для Узбекистана: оригиналы и аналоги, доставка по Ташкенту.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col">
        <QueryProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
