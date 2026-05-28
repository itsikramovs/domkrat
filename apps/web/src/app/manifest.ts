import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Домкрат — маркетплейс автотоваров',
    short_name: 'Домкрат',
    description:
      'Запчасти и автотовары для Узбекистана: оригиналы и аналоги, доставка по Ташкенту.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#1d6cf5',
    orientation: 'portrait',
    lang: 'ru',
    categories: ['shopping', 'business'],
    icons: [
      { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-mask.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Корзина',
        short_name: 'Корзина',
        url: '/cart',
        icons: [{ src: '/icons/icon-192.svg', sizes: '192x192' }],
      },
      {
        name: 'Заказы',
        short_name: 'Заказы',
        url: '/account/orders',
        icons: [{ src: '/icons/icon-192.svg', sizes: '192x192' }],
      },
    ],
  };
}
