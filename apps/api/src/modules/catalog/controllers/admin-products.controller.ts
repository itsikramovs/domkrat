import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { ReceiptsService } from '../../inventory/services/receipts.service';
import {
  AdminCreateProductDto,
  ModerateProductDto,
  ReceiveProductDto,
  UpdateProductDto,
} from '../dto/create-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { ProductsService } from '../services/products.service';

@ApiTags('Admin · Products')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly receipts: ReceiptsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Все товары (включая неактивные)' })
  list(@Query() query: ListProductsDto) {
    return this.products.listAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Карточка товара (атрибуты, изображения, остаток)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.adminGet(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать товар за мерчанта (DRAFT — продаётся после прихода)' })
  create(@Body() dto: AdminCreateProductDto) {
    return this.products.adminCreate(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Редактировать карточку товара' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.adminUpdate(id, dto);
  }

  @Patch(':id/moderate')
  @ApiOperation({ summary: 'Модерация: APPROVE (ACTIVE) / REJECT' })
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateProductDto) {
    return this.products.moderate(id, dto);
  }

  @Post(':id/receive')
  @ApiOperation({
    summary: 'Оприходовать: приёмка + размещение на ячейку → товар становится продаваемым',
  })
  async receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const product = await this.products.adminGet(id);
    await this.receipts.quickReceiveAndPlace({
      merchantId: product.merchantId,
      productId: id,
      warehouseId: dto.warehouseId,
      cellId: dto.cellId,
      quantity: dto.quantity,
      unitCost: dto.unitCost ?? null,
      performedById: user.id,
    });
    return this.products.adminActivate(id);
  }
}
