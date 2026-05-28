import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { ListBannersDto } from '../dto/list-banners.dto';
import { BannersService } from '../services/banners.service';

@ApiTags('Banners')
@Public()
@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'Активные баннеры (фильтр по position)' })
  list(@Query() query: ListBannersDto) {
    return this.banners.list(query);
  }

  @Post(':id/click')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Зафиксировать клик по баннеру (метрика)' })
  trackClick(@Param('id') id: string) {
    return this.banners.trackClick(id);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Зафиксировать показ баннера (метрика)' })
  trackView(@Param('id') id: string) {
    return this.banners.trackView(id);
  }
}
