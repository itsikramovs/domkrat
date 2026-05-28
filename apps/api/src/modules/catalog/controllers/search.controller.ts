import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { CarsService } from '../../cars/services/cars.service';
import { ProductsService } from '../services/products.service';

@ApiTags('Catalog · Search')
@Public()
@Controller('search')
export class SearchController {
  constructor(
    private readonly products: ProductsService,
    private readonly cars: CarsService,
  ) {}

  @Get('by-oem')
  @ApiOperation({ summary: 'Поиск товаров по OEM-номеру' })
  byOem(@Query('oem') oem?: string) {
    if (!oem) throw new BadRequestException('Query param "oem" is required');
    return this.products.searchByOem(oem);
  }

  @Get('by-vin')
  @ApiOperation({ summary: 'Поиск товаров по VIN: резолв → совместимые товары' })
  async byVin(
    @Query('vin') vin?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    if (!vin) throw new BadRequestException('Query param "vin" is required');
    const vehicle = await this.cars.resolveVin(vin);
    const result = await this.products.listPublic({
      carModificationId: vehicle?.carModification?.id,
      page: page ? Number(page) : 1,
      perPage: perPage ? Math.min(Number(perPage), 100) : 24,
    });
    return { vehicle, ...result };
  }
}
