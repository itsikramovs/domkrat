import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { ProductsService } from '../services/products.service';

@ApiTags('Catalog · Search')
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly products: ProductsService) {}

  @Get('by-oem')
  @ApiOperation({ summary: 'Поиск товаров по OEM-номеру' })
  byOem(@Query('oem') oem?: string) {
    if (!oem) throw new BadRequestException('Query param "oem" is required');
    return this.products.searchByOem(oem);
  }
}
