import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { ReceiptsService } from '../../inventory/services/receipts.service';
import {
  AdminCreateProductDto,
  ModerateProductDto,
  ReceiveBatchDto,
  ReceiveProductDto,
  UpdateProductDto,
} from '../dto/create-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { RegisterProductImageDto } from '../dto/product-image.dto';
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

  @Post('receive-batch')
  @ApiOperation({
    summary: 'Многострочная приёмка: несколько товаров на склад → размещение + активация',
  })
  async receiveBatch(@Body() dto: ReceiveBatchDto, @CurrentUser() user: AuthenticatedUser) {
    const receipt = await this.receipts.quickReceiveMany({
      merchantId: dto.merchantId,
      warehouseId: dto.warehouseId,
      performedById: user.id,
      items: dto.items.map((i) => ({
        productId: i.productId,
        cellId: i.cellId,
        quantity: i.quantity,
        unitCost: i.unitCost ?? null,
      })),
    });
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    for (const pid of ids) await this.products.adminActivate(pid);
    return { receiptId: receipt.id, activated: ids.length };
  }

  // ----- Images -----
  @Post(':id/images')
  @ApiOperation({ summary: 'Добавить изображение товара' })
  addImage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterProductImageDto) {
    return this.products.adminAddImage(id, dto);
  }

  @Patch(':id/images/:imageId/primary')
  @ApiOperation({ summary: 'Сделать изображение главным' })
  setPrimaryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.products.adminSetPrimaryImage(id, imageId);
  }

  @Delete(':id/images/:imageId')
  @ApiOperation({ summary: 'Удалить изображение товара' })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.products.adminRemoveImage(id, imageId);
  }
}
