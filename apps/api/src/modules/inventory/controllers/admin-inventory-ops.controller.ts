import { Controller, Get, Post, Query } from '@nestjs/common';
import { AlertStatus, ReceiptStatus, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { AlertsService } from '../services/alerts.service';
import { ReceiptsService } from '../services/receipts.service';

@ApiTags('Admin · Inventory')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_WORKER)
@Controller('admin/inventory')
export class AdminInventoryOpsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly receipts: ReceiptsService,
  ) {}

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
