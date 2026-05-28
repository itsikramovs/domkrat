import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { ModerateProductDto } from '../dto/create-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { ProductsService } from '../services/products.service';

@ApiTags('Admin · Products')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Все товары (включая неактивные)' })
  list(@Query() query: ListProductsDto) {
    return this.products.listAll(query);
  }

  @Patch(':id/moderate')
  @ApiOperation({ summary: 'Модерация: APPROVE (ACTIVE) / REJECT' })
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateProductDto) {
    return this.products.moderate(id, dto);
  }
}
