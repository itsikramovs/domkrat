import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/add-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Текущая корзина пользователя' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.getOrCreate(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Добавить товар' })
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(user.id, dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Изменить количество' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(user.id, id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Удалить позицию' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cart.removeItem(user.id, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Очистить корзину' })
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.clear(user.id);
  }
}
