import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { PickDto } from './dto/pick.dto';
import { PickingService } from './picking.service';

/**
 * Сборка/отгрузка заказов платформой (FBO) — отбор из платформенных ячеек.
 * Отдельный контроллер от AdminController, маршруты не пересекаются (admin/orders/suborders/*).
 */
@ApiTags('Admin · Fulfillment')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_WORKER)
@Controller('admin/orders/suborders')
export class AdminFulfillmentController {
  constructor(private readonly picking: PickingService) {}

  private actor(user: AuthenticatedUser) {
    return { userId: user.id, merchantId: null, role: 'ADMIN' as const };
  }

  @Get(':id/pick-list')
  @ApiOperation({ summary: 'Лист отбора суб-заказа (FBO): ячейки + подсказка FIFO' })
  pickList(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
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
    return this.picking.pick(id, dto, this.actor(user));
  }

  @Post(':id/assemble')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Быстрая сборка (авто-FIFO → ASSEMBLED)' })
  assemble(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.picking.autoAssemble(id, this.actor(user));
  }

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отгрузить (ASSEMBLED → SHIPPED)' })
  ship(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.picking.ship(id, this.actor(user));
  }
}
