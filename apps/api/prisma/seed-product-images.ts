/**
 * Подтягивает РЕАЛЬНЫЕ изображения товаров из бесплатного источника (Openverse —
 * агрегатор CC-фото с Flickr/Wikimedia, без API-ключа), грузит их в MinIO и
 * создаёт ProductImage. Запрос строится из англоязычного slug товара
 * (тип + бренд), т.е. подбор «под SKU» по мере возможностей источника.
 *
 *   pnpm --filter @domkrat/api exec tsx prisma/seed-product-images.ts
 *
 * Идемпотентно: берёт только товары БЕЗ изображений. Безопасно перезапускать
 * (например, если упёрлись в дневной лимит Openverse 200/день — добьёт остаток
 * на следующем запуске). Дросселирование под бёрст-лимит 20/мин.
 *
 * ENV (с дефолтами под этот сервер):
 *   DATABASE_URL                — обязательно
 *   MINIO_INTERNAL_ENDPOINT=127.0.0.1  MINIO_INTERNAL_PORT=9000
 *   MINIO_ACCESS_KEY=minioadmin        MINIO_SECRET_KEY=minioadmin_dev
 *   MINIO_BUCKET=domkrat-uploads
 *   IMAGE_PUBLIC_BASE=https://cdn.domcrat.uz:443/domkrat-uploads  (URL для БД)
 *   IMAGE_LIMIT                 — ограничить число товаров (для теста)
 */
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { PrismaClient } from '@prisma/client';
import { Client as MinioClient } from 'minio';

const prisma = new PrismaClient();

const BUCKET = process.env.MINIO_BUCKET ?? 'domkrat-uploads';
const PUBLIC_BASE = (
  process.env.IMAGE_PUBLIC_BASE ?? 'https://cdn.domcrat.uz:443/domkrat-uploads'
).replace(/\/+$/, '');
const LIMIT = process.env.IMAGE_LIMIT ? Number(process.env.IMAGE_LIMIT) : undefined;
const OPENVERSE = 'https://api.openverse.org/v1/images/';
const UA = 'domkrat-catalog-seed/1.0 (+https://domcrat.uz)';
const THROTTLE_MS = 3500; // < 20/мин бёрст
const MIN_BYTES = 5_000;
const MAX_BYTES = 8_000_000;

const minio = new MinioClient({
  endPoint: process.env.MINIO_INTERNAL_ENDPOINT ?? '127.0.0.1',
  port: Number(process.env.MINIO_INTERNAL_PORT ?? '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin_dev',
});

/** Англоязычный поисковый запрос «тип + бренд» из slug (без размеров/артикулов). */
function slugQuery(slug: string): string {
  return slug
    .split('-')
    .filter((t) => t.length > 1 && !/\d/.test(t))
    .slice(0, 4)
    .join(' ')
    .trim();
}

/** Запасной запрос по категории, если по slug ничего не нашлось. */
const CATEGORY_FALLBACK: Record<string, string> = {
  fluids: 'motor oil bottle',
  'tires-and-wheels': 'car tire',
  'body-parts': 'car body part',
  interior: 'car interior accessory',
  consumables: 'car spare part',
  'brake-system': 'brake disc pads',
  'engine-parts': 'car engine part',
  electrical: 'car battery',
  suspension: 'car suspension part',
  accessories: 'car accessory',
};

type Candidate = { url: string };

async function openverseSearch(query: string): Promise<Candidate[]> {
  const url = `${OPENVERSE}?q=${encodeURIComponent(query)}&page_size=12&mature=false`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: Array<{ url?: string }> };
    return (json.results ?? [])
      .filter((r): r is { url: string } => typeof r.url === 'string')
      .map((r) => ({ url: r.url }));
  } finally {
    clearTimeout(t);
  }
}

function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

/** Скачивает первый валидный кандидат-картинку. */
async function downloadImage(
  candidates: Candidate[],
): Promise<{ buffer: Buffer; contentType: string } | null> {
  for (const c of candidates.slice(0, 6)) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(c.url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) continue;
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);
      if (buffer.byteLength < MIN_BYTES || buffer.byteLength > MAX_BYTES) continue;
      return { buffer, contentType: ct.split(';')[0]!.trim() };
    } catch {
      // следующий кандидат
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

async function main(): Promise<void> {
  await minio
    .bucketExists(BUCKET)
    .then((ok) => {
      if (!ok) throw new Error(`bucket ${BUCKET} не найден`);
    })
    .catch((e) => {
      throw new Error(`MinIO недоступен: ${(e as Error).message}`);
    });

  const products = await prisma.product.findMany({
    where: { deletedAt: null, images: { none: {} } },
    select: { id: true, slug: true, name: true, category: { select: { slug: true } } },
    orderBy: { createdAt: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(`→ Товаров без изображений: ${products.length}. Источник: Openverse (CC).`);
  let ok = 0;
  let failed = 0;

  for (const [i, p] of products.entries()) {
    const primary = slugQuery(p.slug);
    const fallback = CATEGORY_FALLBACK[p.category.slug] ?? 'car spare part';
    const label = `[${i + 1}/${products.length}] ${p.slug}`;

    try {
      let candidates = await openverseSearch(primary);
      await sleep(THROTTLE_MS);
      if (candidates.length === 0 && fallback !== primary) {
        candidates = await openverseSearch(fallback);
        await sleep(THROTTLE_MS);
      }
      if (candidates.length === 0) {
        console.warn(`  ${label}: нет результатов («${primary}») — пропуск`);
        failed++;
        continue;
      }

      const img = await downloadImage(candidates);
      if (!img) {
        console.warn(`  ${label}: не удалось скачать валидную картинку — пропуск`);
        failed++;
        continue;
      }

      const ext = extFromContentType(img.contentType);
      const objectKey = `product/${p.id}/${randomUUID()}.${ext}`;
      await minio.putObject(BUCKET, objectKey, img.buffer, img.buffer.byteLength, {
        'Content-Type': img.contentType,
      });

      await prisma.productImage.create({
        data: {
          productId: p.id,
          url: `${PUBLIC_BASE}/${objectKey}`,
          altText: p.name as object,
          position: 0,
          isPrimary: true,
          fileSize: img.buffer.byteLength,
        },
      });

      ok++;
      console.log(`  ${label}: ✓ «${primary}» (${Math.round(img.buffer.byteLength / 1024)} КБ)`);
    } catch (e) {
      if ((e as Error).message === 'RATE_LIMIT') {
        console.error(
          `  ${label}: упёрлись в лимит Openverse (200/день). Залито ${ok}. ` +
            `Перезапусти скрипт позже — добьёт остаток.`,
        );
        break;
      }
      failed++;
      console.warn(`  ${label}: ошибка — ${(e as Error).message}`);
    }
  }

  console.log(`✓ Готово. Загружено: ${ok}, пропущено/ошибок: ${failed}.`);
}

main()
  .catch((e) => {
    console.error('✗ Импорт упал:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
