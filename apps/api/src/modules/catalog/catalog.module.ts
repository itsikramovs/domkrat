import { Module } from '@nestjs/common';

import { CarsModule } from '../cars/cars.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AdminAttributesController } from './controllers/admin-attributes.controller';
import { AdminCatalogController } from './controllers/admin-catalog.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { BrandsController } from './controllers/brands.controller';
import { CategoriesController } from './controllers/categories.controller';
import { MerchantProductsController } from './controllers/merchant-products.controller';
import { ProductsController } from './controllers/products.controller';
import { SearchController } from './controllers/search.controller';
import { AttributesService } from './services/attributes.service';
import { BrandsService } from './services/brands.service';
import { CategoriesService } from './services/categories.service';
import { ProductOffersService } from './services/product-offers.service';
import { ProductVariantsService } from './services/product-variants.service';
import { ProductsService } from './services/products.service';

@Module({
  imports: [CarsModule, InventoryModule],
  controllers: [
    CategoriesController,
    BrandsController,
    ProductsController,
    SearchController,
    MerchantProductsController,
    AdminCatalogController,
    AdminProductsController,
    AdminAttributesController,
  ],
  providers: [
    CategoriesService,
    BrandsService,
    ProductsService,
    ProductVariantsService,
    ProductOffersService,
    AttributesService,
  ],
  exports: [
    CategoriesService,
    BrandsService,
    ProductsService,
    ProductVariantsService,
    ProductOffersService,
    AttributesService,
  ],
})
export class CatalogModule {}
