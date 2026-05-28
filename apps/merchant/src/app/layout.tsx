import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { MerchantHeader } from '@/components/merchant-header';
import { QueryProvider } from '@/lib/query-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Domkrat — кабинет мерчанта',
  description: 'Управление товарами, заказами и финансами',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background">
        <QueryProvider>
          <MerchantHeader />
          <main>{children}</main>
        </QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
