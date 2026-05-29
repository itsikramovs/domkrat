import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';

import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { PromoCodesService } from './promo-codes.service';

@ApiTags('Admin · Promo codes')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
@Controller('admin/promo-codes')
export class AdminPromoCodesController {
  constructor(private readonly promos: PromoCodesService) {}

  @Get()
  @ApiOperation({ summary: 'Список промокодов' })
  list(
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.promos.list({
      search,
      active: active === undefined ? undefined : active === 'true',
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 50,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали промокода' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.promos.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать промокод' })
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promos.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить промокод' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promos.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить промокод' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.promos.remove(id);
  }
}
