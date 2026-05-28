import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://192.168.1.8:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Закрываем приватные разделы и любые формы с авторизацией от индексации.
        disallow: ['/account/', '/cart', '/checkout', '/login', '/register', '/verify-email'],
        allow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
