import type { MetadataRoute } from 'next';

import { serverApi } from '@/lib/api-client';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://192.168.1.8:3000';

// Кэшируем sitemap на час — он часто перестраивается ботами поисковиков.
export const revalidate = 3600;

type Category = { slug: string };
type Brand = { slug: string };
type Product = { id: string; slug?: string };

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const api = serverApi();
  const now = new Date();

  const [categories, brands, productsResponse] = await Promise.all([
    safe(api<Category[]>('/categories'), []),
    safe(api<Brand[]>('/brands'), []),
    // Topp-N товаров по популярности — больше тысячи в sitemap класть смысла нет.
    safe(api<{ items: Product[] }>('/products?perPage=500&sort=popular'), { items: [] }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/catalog`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/brands`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/stores`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/offer`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    {
      url: `${SITE_URL}/returns-policy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const brandRoutes: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${SITE_URL}/brands/${b.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const productRoutes: MetadataRoute.Sitemap = productsResponse.items.map((p) => ({
    url: `${SITE_URL}/p/${p.slug ?? p.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...brandRoutes, ...productRoutes];
}
