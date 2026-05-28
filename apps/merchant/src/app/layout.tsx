import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Domkrat — маркетплейс автотоваров',
  description: 'Запчасти и автотовары для Узбекистана',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
