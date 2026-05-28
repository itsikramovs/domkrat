import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Toaster } from 'sonner';

import { BottomNav } from '@/components/bottom-nav';
import { QueryProvider } from '@/lib/query-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://192.168.1.8:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Домкрат — маркетплейс автотоваров', template: '%s · Домкрат' },
  description: 'Запчасти и автотовары для Узбекистана: оригиналы и аналоги, доставка по Ташкенту.',
  openGraph: {
    type: 'website',
    siteName: 'Домкрат',
    locale: 'ru_RU',
    alternateLocale: ['uz_UZ'],
    images: [{ url: '/icons/icon-512.svg', width: 512, height: 512, alt: 'Домкрат' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Домкрат — маркетплейс автотоваров',
    description: 'Запчасти и автотовары для Узбекистана.',
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d6cf5',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
