import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { ListProductsDto } from '../dto/list-products.dto';
import { ProductsService } from '../services/products.service';

@ApiTags('Catalog · Products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Список товаров (фильтры + пагинация)' })
  list(@Query() query: ListProductsDto) {
    return this.products.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Карточка товара (по slug)' })
  getBySlug(@Param('slug') slug: string) {
    return this.products.getBySlugPublic(slug);
  }
}
