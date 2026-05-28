import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { BrandsService } from '../services/brands.service';

@ApiTags('Catalog · Brands')
@Public()
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'Список активных брендов' })
  list() {
    return this.brands.list();
  }

  @Get('popular')
  @ApiOperation({ summary: 'Популярные бренды (top N)' })
  popular(@Query('limit') limit?: string) {
    return this.brands.popular(limit ? Math.min(Number(limit), 50) : 10);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Бренд по slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.brands.getBySlug(slug);
  }
}
