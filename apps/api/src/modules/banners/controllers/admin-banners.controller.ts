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

import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateBannerDto, UpdateBannerDto } from '../dto/create-banner.dto';
import { BannersService } from '../services/banners.service';

@ApiTags('Admin · Banners')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'Все баннеры (включая неактивные)' })
  list(@Query('position') position?: string) {
    return this.banners.listAll(position);
  }

  @Post()
  @ApiOperation({ summary: 'Создать баннер' })
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить баннер' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить баннер' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.banners.remove(id);
  }
}
