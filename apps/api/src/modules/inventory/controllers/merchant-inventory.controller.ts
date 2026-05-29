import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ReceiptStatus, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import {
  CreateReceiptDto,
  PlacementDto,
  QualityCheckDto,
  ReceiveItemsDto,
} from '../dto/receipt.dto';
import {
  CreateCellDto,
  CreateRackDto,
  CreateShelfDto,
  CreateWarehouseDto,
  CreateZoneDto,
  QuickCellDto,
  UpdateWarehouseDto,
} from '../dto/warehouse.dto';
import { InventoryService } from '../services/inventory.service';
import { ReceiptsService } from '../services/receipts.service';
import { WarehousesService } from '../services/warehouses.service';

@ApiTags('Merchant · Inventory')
@ApiBearerAuth()
@Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
@Controller('merchant')
export class MerchantInventoryController {
  constructor(
    private readonly warehouses: WarehousesService,
    private readonly receipts: ReceiptsService,
    private readonly inventory: InventoryService,
  ) {}

  // ---------------- Склады ----------------
  @Get('warehouses')
  @ApiOperation({ summary: 'Мои склады' })
  listWarehouses(@CurrentUser() u: AuthenticatedUser) {
    return this.warehouses.list({ merchantId: this.mid(u) });
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'Создать свой склад (FBS)' })
  createWarehouse(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreateWarehouseDto) {
    return this.warehouses.createForMerchant(this.mid(u), dto);
  }

  @Get('warehouses/:id')
  @ApiOperation({ summary: 'Склад + иерархия' })
  getWarehouse(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.get(id, this.mid(u));
  }

  @Patch('warehouses/:id')
  updateWarehouse(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(id, dto, this.mid(u));
  }

  @Get('warehouses/:id/cells')
  @ApiOperation({ summary: 'Ячейки склада (для размещения)' })
  listCells(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.listCells(id, this.mid(u));
  }

  @Post('warehouses/:id/zones')
  addZone(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateZoneDto,
  ) {
    return this.warehouses.addZone(id, dto, this.mid(u));
  }

  @Post('zones/:id/racks')
  addRack(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRackDto,
  ) {
    return this.warehouses.addRack(id, dto, this.mid(u));
  }

  @Post('racks/:id/shelves')
  addShelf(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShelfDto,
  ) {
    return this.warehouses.addShelf(id, dto, this.mid(u));
  }

  @Post('shelves/:id/cells')
  addCell(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCellDto,
  ) {
    return this.warehouses.addCell(id, dto, this.mid(u));
  }

  @Post('warehouses/:id/quick-cell')
  @ApiOperation({ summary: 'Быстро добавить ячейку (авто зона/стеллаж/полка)' })
  quickCell(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuickCellDto,
  ) {
    return this.warehouses.quickAddCell(id, dto, this.mid(u));
  }

  // ---------------- Приёмки (приходование) ----------------
  @Get('receipts')
  @ApiOperation({ summary: 'Мои приёмки' })
  listReceipts(@CurrentUser() u: AuthenticatedUser, @Query('status') status?: ReceiptStatus) {
    return this.receipts.list(this.mid(u), { status });
  }

  @Post('receipts')
  @ApiOperation({ summary: 'Создать приёмку (DRAFT)' })
  createReceipt(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreateReceiptDto) {
    return this.receipts.create(this.mid(u), dto);
  }

  @Get('receipts/:id')
  getReceipt(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.get(id, this.mid(u));
  }

  @Post('receipts/:id/submit')
  @ApiOperation({ summary: 'В ожидание (DRAFT → EXPECTED)' })
  submitReceipt(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.submit(id, this.mid(u));
  }

  @Post('receipts/:id/receive')
  @ApiOperation({ summary: 'Приёмка по факту (→ ARRIVED)' })
  receiveReceipt(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveItemsDto,
  ) {
    return this.receipts.receive(id, this.mid(u), dto, u.id);
  }

  @Post('receipts/:id/quality-check')
  @ApiOperation({ summary: 'Контроль качества (→ PLACING)' })
  qualityCheck(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QualityCheckDto,
  ) {
    return this.receipts.qualityCheck(id, this.mid(u), dto);
  }

  @Post('receipts/:id/place')
  @ApiOperation({ summary: 'Размещение по ячейкам (→ COMPLETED)' })
  place(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlacementDto,
  ) {
    return this.receipts.place(id, this.mid(u), dto, u.id);
  }

  // ---------------- Остатки / движения ----------------
  @Get('inventory/summary')
  summary(@CurrentUser() u: AuthenticatedUser) {
    return this.inventory.summary(this.mid(u));
  }

  @Get('inventory/balances')
  @ApiOperation({ summary: 'Остатки (byCell=true — по ячейкам)' })
  balances(
    @CurrentUser() u: AuthenticatedUser,
    @Query('warehouseId') warehouseId?: string,
    @Query('byCell') byCell?: string,
  ) {
    return this.inventory.listBalances(this.mid(u), { warehouseId, byCell: byCell === 'true' });
  }

  @Get('inventory/movements')
  movements(@CurrentUser() u: AuthenticatedUser, @Query('productId') productId?: string) {
    return this.inventory.listMovements(this.mid(u), { productId });
  }

  private mid(u: AuthenticatedUser): string {
    if (!u.merchantId) throw new BadRequestException('Пользователь не привязан к мерчанту');
    return u.merchantId;
  }
}
