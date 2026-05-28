import { Module } from '@nestjs/common';

import { AdminCatalogController } from './controllers/admin-catalog.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { BrandsController } from './controllers/brands.controller';
import { CategoriesController } from './controllers/categories.controller';
import { MerchantProductsController } from './controllers/merchant-products.controller';
import { ProductsController } from './controllers/products.controller';
import { SearchController } from './controllers/search.controller';
import { BrandsService } from './services/brands.service';
import { CategoriesService } from './services/categories.service';
import { ProductsService } from './services/products.service';

@Module({
  controllers: [
    CategoriesController,
    BrandsController,
    ProductsController,
    SearchController,
    MerchantProductsController,
    AdminCatalogController,
    AdminProductsController,
  ],
  providers: [CategoriesService, BrandsService, ProductsService],
  exports: [CategoriesService, BrandsService, ProductsService],
})
export class CatalogModule {}
