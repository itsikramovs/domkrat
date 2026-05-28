import {
  Body,
  Controller,
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

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Создать заказ из корзины' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.createFromCart(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Мои заказы' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.orders.listMine(
      user.id,
      page ? Number(page) : 1,
      perPage ? Math.min(Number(perPage), 100) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали заказа' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getById(user.id, id);
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Инициировать оплату (MOCK/COD → сразу PAID)' })
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.initiatePayment(user.id, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Отменить заказ (только CREATED/PAID/PROCESSING)' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(user.id, id);
  }

  @Post(':id/confirm-receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Подтвердить получение (SHIPPED → COMPLETED) — кредит мерчантам',
  })
  confirmReceipt(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.confirmReceipt(user.id, id);
  }
}
