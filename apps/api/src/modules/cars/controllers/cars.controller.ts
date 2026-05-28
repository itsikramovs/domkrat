import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { CarsService } from '../services/cars.service';

@ApiTags('Cars · Catalog')
@Public()
@Controller('cars')
export class CarsController {
  constructor(private readonly cars: CarsService) {}

  @Get('makes')
  @ApiOperation({ summary: 'Список марок (?popular=true — только популярные)' })
  makes(@Query('popular') popular?: string) {
    return this.cars.listMakes(popular === 'true' || popular === '1');
  }

  @Get('makes/:id/models')
  @ApiOperation({ summary: 'Модели марки' })
  models(@Param('id') id: string) {
    return this.cars.listModels(id);
  }

  @Get('models/:id/generations')
  @ApiOperation({ summary: 'Поколения модели' })
  generations(@Param('id') id: string) {
    return this.cars.listGenerations(id);
  }

  @Get('generations/:id/modifications')
  @ApiOperation({ summary: 'Модификации поколения' })
  modifications(@Param('id') id: string) {
    return this.cars.listModifications(id);
  }

  @Get('resolve-vin')
  @ApiOperation({ summary: 'Резолв VIN → марка/модель/модификация (MVP по UserGarage)' })
  async resolve(@Query('vin') vin?: string) {
    if (!vin) throw new BadRequestException('Query "vin" is required');
    const result = await this.cars.resolveVin(vin);
    return { found: result !== null, vehicle: result };
  }
}
