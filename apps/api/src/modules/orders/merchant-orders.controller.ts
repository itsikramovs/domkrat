import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { MerchantOrdersService } from './merchant-orders.service';

@ApiTags('Merchant · Orders')
@ApiBearerAuth()
@Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
@Controller('merchant/orders')
export class MerchantOrdersController {
  constructor(private readonly service: MerchantOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Заказы мерчанта (sub-orders)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    this.requireMerchant(user);
    return this.service.list(user.merchantId!, {
      status: status ? (status as OrderStatus) : undefined,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали sub-order' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.service.get(user.merchantId!, id);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подтвердить взятие в работу (PAID → PROCESSING)' })
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.service.confirm(user.merchantId!, id, user.id);
  }

  @Post(':id/ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Готов к отгрузке (PROCESSING → ASSEMBLED)' })
  ready(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.service.ready(user.merchantId!, id, user.id);
  }

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отгрузить (ASSEMBLED → SHIPPED) — списывает stock' })
  ship(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.service.ship(user.merchantId!, id, user.id);
  }

  private requireMerchant(user: AuthenticatedUser): void {
    if (!user.merchantId) throw new BadRequestException('User is not linked to a merchant');
  }
}
