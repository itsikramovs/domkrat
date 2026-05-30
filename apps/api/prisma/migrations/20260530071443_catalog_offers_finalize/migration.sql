-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_merchant_id_fkey";

-- DropIndex
DROP INDEX "cart_items_cart_id_product_id_key";

-- DropIndex
DROP INDEX "inventory_balances_product_id_merchant_id_cell_id_key";

-- DropIndex
DROP INDEX "products_merchant_id_idx";

-- DropIndex
DROP INDEX "products_merchant_id_sku_key";

-- DropIndex
DROP INDEX "products_price_idx";

-- AlterTable
ALTER TABLE "cart_items" ALTER COLUMN "offer_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "inventory_balances" ALTER COLUMN "offer_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "compare_at_price",
DROP COLUMN "cost_price",
DROP COLUMN "currency",
DROP COLUMN "merchant_id",
DROP COLUMN "price",
DROP COLUMN "sku",
DROP COLUMN "vat_rate";

