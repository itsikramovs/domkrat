/**
 * Идемпотентный бэкфилл маркетплейс-модели (карточка → вариант → предложение).
 * Безопасно запускать повторно:
 *   pnpm --filter @domkrat/api exec tsx prisma/backfill-offers.ts
 *
 * Для каждого существующего товара (Product со старыми продающими полями):
 *   1) создаёт ровно один дефолтный ProductVariant,
 *   2) создаёт ровно один ProductOffer из старых merchantId/sku/price/...,
 *   3) проставляет product.createdByMerchantId и product.minPrice,
 *   4) перепривязывает зависимые строки (остатки/движения/резервы/приёмки/
 *      алерты/позиции заказов/корзины) на offer_id/variant_id,
 *   5) проверяет, что не осталось NULL offer_id (иначе throw — блокирует фазу C).
 *
 * Запускать ПОСЛЕ миграции catalog_offers_additive и ДО catalog_offers_finalize.
 * НЕ удаляет ничего.
 */
import { Prisma, PrismaClient, ProductStatus, ProductOfferStatus } from '@prisma/client';

const prisma = new PrismaClient();

function mapStatus(s: ProductStatus): ProductOfferStatus {
  if (s === ProductStatus.ACTIVE) return ProductOfferStatus.ACTIVE;
  if (s === ProductStatus.OUT_OF_STOCK) return ProductOfferStatus.OUT_OF_STOCK;
  return ProductOfferStatus.INACTIVE;
}

async function backfillVariantsAndOffers() {
  // Старые продающие поля ещё присутствуют на Product (фаза A их сохранила).
  const products = await prisma.product.findMany({
    select: {
      id: true,
      merchantId: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      costPrice: true,
      vatRate: true,
      currency: true,
      status: true,
      deletedAt: true,
      createdByMerchantId: true,
      minPrice: true,
    },
  });

  let variantsCreated = 0;
  let offersCreated = 0;
  let productsUpdated = 0;

  for (const p of products) {
    // 1) дефолтный вариант (идемпотентно)
    let variant = await prisma.productVariant.findFirst({
      where: { productId: p.id, isDefault: true },
      select: { id: true },
    });
    if (!variant) {
      variant = await prisma.productVariant.create({
        data: { productId: p.id, name: Prisma.JsonNull, position: 0, isDefault: true },
        select: { id: true },
      });
      variantsCreated++;
    }

    // 2) предложение (идемпотентно по natural unique merchantId+sku)
    let offer = await prisma.productOffer.findFirst({
      where: { merchantId: p.merchantId, sku: p.sku },
      select: { id: true, price: true },
    });
    if (!offer) {
      offer = await prisma.productOffer.create({
        data: {
          variantId: variant.id,
          productId: p.id,
          merchantId: p.merchantId,
          sku: p.sku,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          costPrice: p.costPrice,
          vatRate: p.vatRate,
          currency: p.currency,
          status: mapStatus(p.status),
          deletedAt: p.deletedAt,
        },
        select: { id: true, price: true },
      });
      offersCreated++;
    }

    // 3) createdByMerchantId + minPrice на карточке
    const needsCreator = p.createdByMerchantId === null;
    const needsMinPrice = p.minPrice === null;
    if (needsCreator || needsMinPrice) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          ...(needsCreator ? { createdByMerchantId: p.merchantId } : {}),
          ...(needsMinPrice ? { minPrice: offer.price } : {}),
        },
      });
      productsUpdated++;
    }
  }

  return { products: products.length, variantsCreated, offersCreated, productsUpdated };
}

async function rekeyDependentRows() {
  // Каждая пара (product_id, merchant_id) до рефактора однозначно отображается
  // на одно предложение/вариант. UPDATE'ы идемпотентны (offer_id IS NULL).
  const ib = await prisma.$executeRaw`
    UPDATE inventory_balances ib
    SET offer_id = o.id, variant_id = o.variant_id
    FROM product_offers o
    WHERE ib.product_id = o.product_id AND ib.merchant_id = o.merchant_id
      AND ib.offer_id IS NULL`;

  const sm = await prisma.$executeRaw`
    UPDATE stock_movements sm
    SET offer_id = o.id, variant_id = o.variant_id
    FROM product_offers o
    WHERE sm.product_id = o.product_id AND sm.merchant_id = o.merchant_id
      AND sm.offer_id IS NULL`;

  const sr = await prisma.$executeRaw`
    UPDATE stock_reservations sr
    SET offer_id = o.id, variant_id = o.variant_id
    FROM product_offers o
    WHERE sr.product_id = o.product_id AND sr.merchant_id = o.merchant_id
      AND sr.offer_id IS NULL`;

  const ia = await prisma.$executeRaw`
    UPDATE inventory_alerts ia
    SET offer_id = o.id, variant_id = o.variant_id
    FROM product_offers o
    WHERE ia.product_id = o.product_id AND ia.merchant_id = o.merchant_id
      AND ia.offer_id IS NULL`;

  const oi = await prisma.$executeRaw`
    UPDATE order_items oi
    SET offer_id = o.id, variant_id = o.variant_id
    FROM product_offers o
    WHERE oi.product_id = o.product_id AND oi.merchant_id = o.merchant_id
      AND oi.offer_id IS NULL`;

  // stock_receipt_items: нет merchant_id → join через stock_receipts.
  const sri = await prisma.$executeRaw`
    UPDATE stock_receipt_items sri
    SET offer_id = o.id, variant_id = o.variant_id
    FROM product_offers o, stock_receipts r
    WHERE sri.receipt_id = r.id
      AND sri.product_id = o.product_id AND r.merchant_id = o.merchant_id
      AND sri.offer_id IS NULL`;

  // cart_items: нет merchant_id (до рефактора 1 offer на product → однозначно).
  const ci = await prisma.$executeRaw`
    UPDATE cart_items ci
    SET offer_id = o.id
    FROM product_offers o
    WHERE ci.product_id = o.product_id
      AND ci.offer_id IS NULL`;

  return {
    inventory_balances: ib,
    stock_movements: sm,
    stock_reservations: sr,
    inventory_alerts: ia,
    order_items: oi,
    stock_receipt_items: sri,
    cart_items: ci,
  };
}

async function assertNoNulls() {
  const tables = [
    'inventory_balances',
    'stock_movements',
    'stock_reservations',
    'inventory_alerts',
    'order_items',
    'stock_receipt_items',
    'cart_items',
  ];
  const remaining: Record<string, number> = {};
  for (const t of tables) {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM "${t}" WHERE offer_id IS NULL`,
    );
    remaining[t] = Number(rows[0]?.n ?? 0);
  }
  const bad = Object.entries(remaining).filter(([, n]) => n > 0);
  if (bad.length > 0) {
    throw new Error(
      `Бэкфилл НЕ завершён — остались NULL offer_id: ${bad
        .map(([t, n]) => `${t}=${n}`)
        .join(', ')}. НЕ запускай фазу C.`,
    );
  }
  return remaining;
}

async function main() {
  console.log('→ Бэкфилл маркетплейс-модели (variants/offers)…');
  const created = await backfillVariantsAndOffers();
  console.log('  карточки/варианты/предложения:', created);

  const rekeyed = await rekeyDependentRows();
  console.log('  перепривязано строк:', rekeyed);

  const remaining = await assertNoNulls();
  console.log('  осталось NULL offer_id (должно быть 0):', remaining);

  const [variants, offers] = await Promise.all([
    prisma.productVariant.count(),
    prisma.productOffer.count(),
  ]);
  console.log(`✓ Готово. Всего вариантов=${variants}, предложений=${offers}.`);
}

main()
  .catch((e) => {
    console.error('✗ Бэкфилл упал:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
