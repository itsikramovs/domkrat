-- Additive: new compound uniques for offer-keyed inventory and cart.
-- Old uniques (products_merchant_sku, inventory productId_merchantId_cellId,
-- cart cartId_productId) are dropped later in catalog_offers_finalize.
CREATE UNIQUE INDEX "inventory_balances_offer_id_cell_id_key" ON "inventory_balances"("offer_id", "cell_id");
CREATE UNIQUE INDEX "cart_items_cart_id_offer_id_key" ON "cart_items"("cart_id", "offer_id");
