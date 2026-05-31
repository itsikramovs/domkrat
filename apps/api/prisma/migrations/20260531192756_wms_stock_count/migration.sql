-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "status" "StockCountStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_items" (
    "id" TEXT NOT NULL,
    "count_id" TEXT NOT NULL,
    "cell_id" TEXT NOT NULL,
    "cell_code" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "merchant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "product_name" JSONB NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "counted_qty" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_counts_warehouse_id_idx" ON "stock_counts"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_counts_merchant_id_idx" ON "stock_counts"("merchant_id");

-- CreateIndex
CREATE INDEX "stock_counts_status_idx" ON "stock_counts"("status");

-- CreateIndex
CREATE INDEX "stock_count_items_count_id_idx" ON "stock_count_items"("count_id");

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
