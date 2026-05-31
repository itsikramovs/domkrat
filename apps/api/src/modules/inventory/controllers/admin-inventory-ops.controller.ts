import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AlertStatus, ReceiptStatus, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { CreateStockCountDto, SaveStockCountDto } from '../dto/count.dto';
import { AlertsService } from '../services/alerts.service';
import { ReceiptsService } from '../services/receipts.service';
import { StockCountService } from '../services/stock-count.service';

@ApiTags('Admin · Inventory')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_WORKER)
@Controller('admin/inventory')
export class AdminInventoryOpsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly receipts: ReceiptsService,
    private readonly counts: StockCountService,
  ) {}

  private actor(user: AuthenticatedUser) {
    return { userId: user.id, merchantId: null };
  }

  @Get('counts')
  @ApiOperation({ summary: 'Список ревизий (все склады)' })
  listCounts(@CurrentUser() user: AuthenticatedUser) {
    return this.counts.list(this.actor(user));
  }

  @Post('counts')
  @ApiOperation({ summary: 'Создать ревизию (снимок остатков по ячейкам склада)' })
  createCount(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStockCountDto) {
    return this.counts.create(dto, this.actor(user));
  }

  @Get('counts/:id')
  @ApiOperation({ summary: 'Ревизия + позиции' })
  getCount(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.get(id, this.actor(user));
  }

  @Post('counts/:id/save')
  @ApiOperation({ summary: 'Сохранить фактические количества' })
  saveCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveStockCountDto,
  ) {
    return this.counts.saveCounts(id, dto.items, this.actor(user));
  }

  @Post('counts/:id/complete')
  @ApiOperation({ summary: 'Завершить ревизию → корректировки остатков' })
  completeCount(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.complete(id, this.actor(user));
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Алерты всех мерчантов' })
  alerts_(@Query('status') status?: AlertStatus) {
    return this.alerts.listAll(status ?? AlertStatus.ACTIVE);
  }

  @Post('alerts/scan')
  @ApiOperation({ summary: 'Запустить скан остатков вручную' })
  scan() {
    return this.alerts.scan();
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Приёмки всех мерчантов' })
  receipts_(@Query('status') status?: ReceiptStatus) {
    return this.receipts.listAll({ status });
  }
}
