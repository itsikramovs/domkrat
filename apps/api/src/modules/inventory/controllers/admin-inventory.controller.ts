import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole, WarehouseType } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CreateCellDto,
  CreateRackDto,
  CreateShelfDto,
  CreateWarehouseDto,
  CreateZoneDto,
  UpdateWarehouseDto,
} from '../dto/warehouse.dto';
import { WarehousesService } from '../services/warehouses.service';

@ApiTags('Admin · Warehouses')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_WORKER)
@Controller('admin/warehouses')
export class AdminInventoryController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @ApiOperation({ summary: 'Все склады (фильтр по типу)' })
  list(@Query('type') type?: WarehouseType) {
    // merchantId не передаём → видим все склады
    return this.warehouses.list(type ? { type } : {});
  }

  @Post()
  @ApiOperation({ summary: 'Создать платформенный склад' })
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.createPlatform(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Склад + иерархия' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.get(id); // без merchantId → без ограничения владельца
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  @Get(':id/cells')
  listCells(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehouses.listCells(id);
  }

  @Post(':id/zones')
  addZone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateZoneDto) {
    return this.warehouses.addZone(id, dto);
  }

  @Post('zones/:id/racks')
  addRack(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateRackDto) {
    return this.warehouses.addRack(id, dto);
  }

  @Post('racks/:id/shelves')
  addShelf(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateShelfDto) {
    return this.warehouses.addShelf(id, dto);
  }

  @Post('shelves/:id/cells')
  addCell(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCellDto) {
    return this.warehouses.addCell(id, dto);
  }
}
