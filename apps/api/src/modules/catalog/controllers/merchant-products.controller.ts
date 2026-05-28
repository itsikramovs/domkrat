import {
  BadRequestException,
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

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { CreateCompatibilityDto } from '../dto/compatibility.dto';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from '../dto/create-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { RegisterProductImageDto } from '../dto/product-image.dto';
import { ProductsService } from '../services/products.service';

@ApiTags('Merchant · Products')
@ApiBearerAuth()
@Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
@Controller('merchant/products')
export class MerchantProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Свои товары' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListProductsDto) {
    this.requireMerchant(user);
    return this.products.listForMerchant(user.merchantId!, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали своего товара' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.products.getForMerchant(user.merchantId!, id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать товар (статус PENDING_REVIEW)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto) {
    this.requireMerchant(user);
    return this.products.create(user.merchantId!, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить свой товар' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    this.requireMerchant(user);
    return this.products.update(user.merchantId!, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Изменить статус (ACTIVE/INACTIVE/DRAFT)' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    this.requireMerchant(user);
    return this.products.updateStatus(user.merchantId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить (soft)' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.requireMerchant(user);
    await this.products.remove(user.merchantId!, id);
  }

  // ----- Images -----
  @Get(':id/images')
  @ApiOperation({ summary: 'Изображения товара' })
  listImages(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.products.listImages(user.merchantId!, id);
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Зарегистрировать загруженное изображение' })
  addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterProductImageDto,
  ) {
    this.requireMerchant(user);
    return this.products.addImage(user.merchantId!, id, dto);
  }

  @Patch(':id/images/:imageId/primary')
  @ApiOperation({ summary: 'Сделать основным' })
  setPrimaryImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    this.requireMerchant(user);
    return this.products.setPrimaryImage(user.merchantId!, id, imageId);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить изображение' })
  async removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    this.requireMerchant(user);
    await this.products.removeImage(user.merchantId!, id, imageId);
  }

  // ----- Compatibility -----
  @Get(':id/compatibility')
  @ApiOperation({ summary: 'Совместимость с авто' })
  listCompat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireMerchant(user);
    return this.products.listCompatibility(user.merchantId!, id);
  }

  @Post(':id/compatibility')
  @ApiOperation({ summary: 'Добавить совместимость' })
  addCompat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCompatibilityDto,
  ) {
    this.requireMerchant(user);
    return this.products.addCompatibility(user.merchantId!, id, dto);
  }

  @Delete(':id/compatibility/:compatId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить совместимость' })
  async removeCompat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('compatId', ParseUUIDPipe) compatId: string,
  ): Promise<void> {
    this.requireMerchant(user);
    await this.products.removeCompatibility(user.merchantId!, id, compatId);
  }

  private requireMerchant(user: AuthenticatedUser): void {
    if (!user.merchantId) {
      throw new BadRequestException('User is not linked to a merchant');
    }
  }
}
