import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { AdminShell } from '@/components/admin-shell';
import { QueryProvider } from '@/lib/query-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Domkrat — админ-панель',
  description: 'Управление маркетплейсом: мерчанты, заказы, финансы',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background">
        <QueryProvider>
          <AdminShell>{children}</AdminShell>
        </QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
