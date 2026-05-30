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
import { CreateProductOfferDto, SetOfferStatusDto, UpdateProductOfferDto } from '../dto/offer.dto';
import { RegisterProductImageDto } from '../dto/product-image.dto';
import { CreateProductVariantDto, UpdateProductVariantDto } from '../dto/variant.dto';
import { ProductOffersService } from '../services/product-offers.service';
import { ProductVariantsService } from '../services/product-variants.service';
import { ProductsService } from '../services/products.service';

@ApiTags('Admin · Products')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly variants: ProductVariantsService,
    private readonly offers: ProductOffersService,
    private readonly receipts: ReceiptsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Все карточки (включая неактивные)' })
  list(@Query() query: ListProductsDto) {
    return this.products.listAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Карточка (контент, варианты, предложения, остаток)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.adminGet(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать карточку за мерчанта (контент + вариант + предложение, DRAFT)',
  })
  create(@Body() dto: AdminCreateProductDto) {
    return this.products.adminCreate(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Редактировать контент карточки' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.adminUpdate(id, dto);
  }

  @Patch(':id/moderate')
  @ApiOperation({ summary: 'Модерация: APPROVE (ACTIVE) / REJECT' })
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateProductDto) {
    return this.products.moderate(id, dto);
  }

  // ----- Variants -----
  @Get(':id/variants')
  @ApiOperation({ summary: 'Варианты карточки' })
  listVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.variants.listForProduct(id);
  }

  @Post(':id/variants')
  @ApiOperation({ summary: 'Добавить вариант' })
  createVariant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProductVariantDto) {
    return this.variants.create(id, dto);
  }

  @Patch(':id/variants/:variantId')
  @ApiOperation({ summary: 'Изменить вариант' })
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.variants.update(id, variantId, dto);
  }

  @Patch(':id/variants/:variantId/default')
  @ApiOperation({ summary: 'Сделать вариант основным' })
  setDefaultVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.variants.setDefault(id, variantId);
  }

  @Delete(':id/variants/:variantId')
  @ApiOperation({ summary: 'Удалить вариант' })
  removeVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.variants.remove(id, variantId);
  }

  // ----- Offers (multi-seller) -----
  @Get(':id/offers')
  @ApiOperation({ summary: 'Предложения продавцов по карточке (с остатком)' })
  listOffers(@Param('id', ParseUUIDPipe) id: string) {
    return this.offers.listForProduct(id);
  }

  @Post(':id/offers')
  @ApiOperation({ summary: 'Добавить предложение продавца на вариант (мультипродавец)' })
  attachOffer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProductOfferDto) {
    return this.offers.attach(id, dto);
  }

  @Patch('offers/:offerId')
  @ApiOperation({ summary: 'Изменить предложение (цена/НДС/себестоимость/статус)' })
  updateOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateProductOfferDto,
  ) {
    return this.offers.update(offerId, dto);
  }

  @Patch('offers/:offerId/status')
  @ApiOperation({ summary: 'Сменить статус предложения' })
  setOfferStatus(@Param('offerId', ParseUUIDPipe) offerId: string, @Body() dto: SetOfferStatusDto) {
    return this.offers.setStatus(offerId, dto.status);
  }

  @Delete('offers/:offerId')
  @ApiOperation({ summary: 'Удалить предложение' })
  removeOffer(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offers.remove(offerId);
  }

  // ----- Receiving (onto an offer) -----
  @Post(':id/receive')
  @ApiOperation({
    summary: 'Оприходовать предложение: приёмка + размещение на ячейку → продаётся',
  })
  async receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const offer = await this.offers.resolveOfferForReceiving({
      offerId: dto.offerId,
      productId: id,
    });
    await this.receipts.quickReceiveAndPlace({
      offerId: offer.id,
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
    summary: 'Многострочная приёмка: несколько предложений на склад → размещение + активация',
  })
  async receiveBatch(@Body() dto: ReceiveBatchDto, @CurrentUser() user: AuthenticatedUser) {
    const receipt = await this.receipts.quickReceiveMany({
      warehouseId: dto.warehouseId,
      performedById: user.id,
      items: dto.items.map((i) => ({
        offerId: i.offerId,
        cellId: i.cellId,
        quantity: i.quantity,
        unitCost: i.unitCost ?? null,
      })),
    });
    // Активируем карточки по затронутым предложениям.
    const productIds = await this.offers.productIdsForOffers(dto.items.map((i) => i.offerId));
    for (const pid of productIds) await this.products.adminActivate(pid);
    return { receiptId: receipt.id, activated: productIds.length };
  }

  // ----- Images -----
  @Post(':id/images')
  @ApiOperation({ summary: 'Добавить изображение карточки' })
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
  @ApiOperation({ summary: 'Удалить изображение карточки' })
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.products.adminRemoveImage(id, imageId);
  }
}
