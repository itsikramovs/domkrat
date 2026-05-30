import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { ReceiptsService } from '../../inventory/services/receipts.service';
import { ReceiveProductDto } from '../dto/create-product.dto';
import { SetOfferStatusDto, UpdateProductOfferDto } from '../dto/offer.dto';
import { ProductOffersService } from '../services/product-offers.service';

/**
 * Кабинет мерчанта — управление СВОИМИ предложениями (offer): цена, статус, остаток (приход).
 * Контент карточек/варианты ведёт админ; мерчант товары не создаёт.
 */
@ApiTags('Merchant · Offers')
@ApiBearerAuth()
@Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
@Controller('merchant/offers')
export class MerchantOffersController {
  constructor(
    private readonly offers: ProductOffersService,
    private readonly receipts: ReceiptsService,
  ) {}

  private merchantId(user: AuthenticatedUser): string {
    if (!user.merchantId) throw new ForbiddenException('Доступно только мерчанту');
    return user.merchantId;
  }

  @Get()
  @ApiOperation({ summary: 'Мои предложения (карточка, вариант, цена, статус, остаток)' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.offers.listForMerchant(this.merchantId(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Изменить своё предложение (цена/НДС/SKU)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductOfferDto,
  ) {
    await this.offers.assertOwner(id, this.merchantId(user));
    return this.offers.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Статус своего предложения (ACTIVE/INACTIVE/OUT_OF_STOCK)' })
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOfferStatusDto,
  ) {
    await this.offers.assertOwner(id, this.merchantId(user));
    return this.offers.setStatus(id, dto.status);
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Оприходовать своё предложение на склад (приход → остаток)' })
  async receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveProductDto,
  ) {
    await this.offers.assertOwner(id, this.merchantId(user));
    return this.receipts.quickReceiveAndPlace({
      offerId: id,
      warehouseId: dto.warehouseId,
      cellId: dto.cellId,
      quantity: dto.quantity,
      unitCost: dto.unitCost ?? null,
      performedById: user.id,
    });
  }
}
