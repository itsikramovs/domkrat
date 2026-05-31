import {
  BadRequestException,
  Body,
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

import { PickDto } from './dto/pick.dto';
import { MerchantOrdersService } from './merchant-orders.service';
import { PickingService } from './picking.service';

@ApiTags('Merchant · Orders')
@ApiBearerAuth()
@Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
@Controller('merchant/orders')
export class MerchantOrdersController {
  constructor(
    private readonly service: MerchantOrdersService,
    private readonly picking: PickingService,
  ) {}

  private actor(user: AuthenticatedUser) {
    return { userId: user.id, merchantId: user.merchantId!, role: 'MERCHANT' as const };
  }

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

  @Get(':id/pick-list')
  @ApiOperation({ summary: 'Лист отбора: ячейки с остатком + подсказка FIFO по позициям' })
  pickList(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.picking.getPickList(id, this.actor(user));
  }

  @Post(':id/pick')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подтвердить сборку из ячеек (→ ASSEMBLED, списание из ячеек)' })
  pick(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PickDto,
  ) {
    this.requireMerchant(user);
    return this.picking.pick(id, dto, this.actor(user));
  }

  @Post(':id/ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Быстрая сборка авто-FIFO (PROCESSING → ASSEMBLED, списание из ячеек)' })
  ready(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.picking.autoAssemble(id, this.actor(user));
  }

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отгрузить (ASSEMBLED → SHIPPED)' })
  ship(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    this.requireMerchant(user);
    return this.picking.ship(id, this.actor(user));
  }

  private requireMerchant(user: AuthenticatedUser): void {
    if (!user.merchantId) throw new BadRequestException('User is not linked to a merchant');
  }
}
