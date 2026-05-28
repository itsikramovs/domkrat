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
import { ReturnStatus, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnsService } from './returns.service';

@ApiTags('Returns')
@ApiBearerAuth()
@Controller()
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('orders/:id/return-request')
  @ApiOperation({ summary: 'Запросить возврат для заказа' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returns.createForOrder(user.id, orderId, dto);
  }

  @Roles(UserRole.CUSTOMER)
  @Get('returns')
  @ApiOperation({ summary: 'Мои возвраты' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.returns.listMine(user.id);
  }

  @Roles(UserRole.CUSTOMER)
  @Get('returns/:id')
  @ApiOperation({ summary: 'Детали возврата' })
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.getMine(user.id, id);
  }

  @Roles(UserRole.CUSTOMER)
  @Post('returns/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отменить заявку (только REQUESTED)' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.cancel(user.id, id);
  }

  // ---- Admin ----

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('admin/returns')
  @ApiOperation({ summary: 'Все возвраты' })
  listAll(
    @Query('status') status?: ReturnStatus,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.returns.listAll({
      status,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('admin/returns/:id/approve')
  @ApiOperation({ summary: 'Одобрить заявку' })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.approve(id, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('admin/returns/:id/reject')
  @ApiOperation({ summary: 'Отклонить' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ) {
    return this.returns.reject(id, user.id, body.reason);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Post('admin/returns/:id/complete')
  @ApiOperation({ summary: 'Завершить возврат (refund + restock)' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { restocked: boolean },
  ) {
    return this.returns.complete(id, user.id, body.restocked ?? true);
  }

  // ---- Patch status (для inspection workflow) — admin only ----
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/returns/:id/status')
  @ApiOperation({ summary: 'Установить status (RECEIVED/INSPECTING/...)' })
  setStatus(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body() body: { status: ReturnStatus },
  ) {
    // Простое обновление — без сложной валидации для MVP
    return this.returns['prisma'].return.update({ where: { id: _id }, data: { status: body.status } });
  }
}
