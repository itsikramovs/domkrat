-- CreateEnum
CREATE TYPE "ProductOfferStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "offer_id" TEXT;

-- AlterTable
ALTER TABLE "inventory_alerts" ADD COLUMN     "offer_id" TEXT,
ADD COLUMN     "variant_id" TEXT;

-- AlterTable
ALTER TABLE "inventory_balances" ADD COLUMN     "offer_id" TEXT,
ADD COLUMN     "variant_id" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "offer_id" TEXT,
ADD COLUMN     "variant_id" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "created_by_merchant_id" TEXT,
ADD COLUMN     "min_price" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "offer_id" TEXT,
ADD COLUMN     "variant_id" TEXT;

-- AlterTable
ALTER TABLE "stock_receipt_items" ADD COLUMN     "offer_id" TEXT,
ADD COLUMN     "variant_id" TEXT;

-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "offer_id" TEXT,
ADD COLUMN     "variant_id" TEXT;

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" JSONB,
    "barcode" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_offers" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "compare_at_price" DECIMAL(15,2),
    "cost_price" DECIMAL(15,2),
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" "ProductOfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_offers_product_id_idx" ON "product_offers"("product_id");

-- CreateIndex
CREATE INDEX "product_offers_variant_id_idx" ON "product_offers"("variant_id");

-- CreateIndex
CREATE INDEX "product_offers_merchant_id_idx" ON "product_offers"("merchant_id");

-- CreateIndex
CREATE INDEX "product_offers_status_idx" ON "product_offers"("status");

-- CreateIndex
CREATE INDEX "product_offers_price_idx" ON "product_offers"("price");

-- CreateIndex
CREATE UNIQUE INDEX "product_offers_merchant_id_sku_key" ON "product_offers"("merchant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_offers_variant_id_merchant_id_key" ON "product_offers"("variant_id", "merchant_id");

-- CreateIndex
CREATE INDEX "cart_items_offer_id_idx" ON "cart_items"("offer_id");

-- CreateIndex
CREATE INDEX "inventory_alerts_offer_id_idx" ON "inventory_alerts"("offer_id");

-- CreateIndex
CREATE INDEX "inventory_balances_offer_id_idx" ON "inventory_balances"("offer_id");

-- CreateIndex
CREATE INDEX "inventory_balances_variant_id_idx" ON "inventory_balances"("variant_id");

-- CreateIndex
CREATE INDEX "order_items_offer_id_idx" ON "order_items"("offer_id");

-- CreateIndex
CREATE INDEX "products_created_by_merchant_id_idx" ON "products"("created_by_merchant_id");

-- CreateIndex
CREATE INDEX "products_min_price_idx" ON "products"("min_price");

-- CreateIndex
CREATE INDEX "stock_movements_offer_id_idx" ON "stock_movements"("offer_id");

-- CreateIndex
CREATE INDEX "stock_receipt_items_offer_id_idx" ON "stock_receipt_items"("offer_id");

-- CreateIndex
CREATE INDEX "stock_reservations_offer_id_idx" ON "stock_reservations"("offer_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_merchant_id_fkey" FOREIGN KEY ("created_by_merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "product_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
