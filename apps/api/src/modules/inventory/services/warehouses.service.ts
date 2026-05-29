import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WarehouseType } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  CreateCellDto,
  CreateRackDto,
  CreateShelfDto,
  CreateWarehouseDto,
  CreateZoneDto,
  UpdateWarehouseDto,
} from '../dto/warehouse.dto';

/**
 * Управление складами и иерархией хранения: Warehouse → Zone → Rack → Shelf → Cell.
 * merchantId !== undefined → контекст мерчанта (видит/правит только свои склады).
 */
@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  list(filter: { merchantId?: string | null; type?: WarehouseType }) {
    const where: Prisma.WarehouseWhereInput = {};
    if (filter.merchantId !== undefined) where.merchantId = filter.merchantId;
    if (filter.type) where.type = filter.type;
    return this.prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { zones: true, inventoryBalances: true, stockReceipts: true } },
      },
    });
  }

  async get(id: string, merchantId?: string) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        zones: {
          orderBy: { position: 'asc' },
          include: {
            racks: {
              orderBy: { position: 'asc' },
              include: { shelves: { orderBy: { level: 'asc' }, include: { cells: true } } },
            },
          },
        },
      },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');
    this.assertOwner(wh.merchantId, merchantId);
    return wh;
  }

  async createForMerchant(merchantId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: {
        code: dto.code,
        name: dto.name as unknown as Prisma.InputJsonValue,
        type: WarehouseType.MERCHANT,
        merchantId,
        address: dto.address,
        region: dto.region,
        city: dto.city,
        contactPhone: dto.contactPhone,
        isPickupPoint: dto.isPickupPoint ?? false,
      },
    });
  }

  async createPlatform(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: {
        code: dto.code,
        name: dto.name as unknown as Prisma.InputJsonValue,
        type: dto.type === WarehouseType.MERCHANT ? WarehouseType.PLATFORM : dto.type,
        merchantId: null,
        address: dto.address,
        region: dto.region,
        city: dto.city,
        contactPhone: dto.contactPhone,
        isPickupPoint: dto.isPickupPoint ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateWarehouseDto, merchantId?: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!wh) throw new NotFoundException('Warehouse not found');
    this.assertOwner(wh.merchantId, merchantId);
    return this.prisma.warehouse.update({
      where: { id },
      data: {
        name: dto.name ? (dto.name as unknown as Prisma.InputJsonValue) : undefined,
        address: dto.address,
        region: dto.region,
        city: dto.city,
        contactPhone: dto.contactPhone,
        isActive: dto.isActive,
        isPickupPoint: dto.isPickupPoint,
      },
    });
  }

  // ---------- Иерархия ----------

  async addZone(warehouseId: string, dto: CreateZoneDto, merchantId?: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh) throw new NotFoundException('Warehouse not found');
    this.assertOwner(wh.merchantId, merchantId);
    return this.prisma.warehouseZone.create({
      data: {
        warehouseId,
        code: dto.code,
        name: dto.name as unknown as Prisma.InputJsonValue,
        categoryRestrictions: dto.categoryRestrictions ?? [],
        isHazardous: dto.isHazardous ?? false,
      },
    });
  }

  async addRack(zoneId: string, dto: CreateRackDto, merchantId?: string) {
    const zone = await this.prisma.warehouseZone.findUnique({
      where: { id: zoneId },
      include: { warehouse: { select: { merchantId: true } } },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    this.assertOwner(zone.warehouse.merchantId, merchantId);
    return this.prisma.warehouseRack.create({
      data: { zoneId, code: dto.code, maxWeightKg: dto.maxWeightKg?.toString() },
    });
  }

  async addShelf(rackId: string, dto: CreateShelfDto, merchantId?: string) {
    const rack = await this.prisma.warehouseRack.findUnique({
      where: { id: rackId },
      include: { zone: { include: { warehouse: { select: { merchantId: true } } } } },
    });
    if (!rack) throw new NotFoundException('Rack not found');
    this.assertOwner(rack.zone.warehouse.merchantId, merchantId);
    return this.prisma.warehouseShelf.create({
      data: { rackId, code: dto.code, level: dto.level, maxWeightKg: dto.maxWeightKg?.toString() },
    });
  }

  async addCell(shelfId: string, dto: CreateCellDto, merchantId?: string) {
    const shelf = await this.prisma.warehouseShelf.findUnique({
      where: { id: shelfId },
      include: {
        rack: { include: { zone: { include: { warehouse: { select: { merchantId: true } } } } } },
      },
    });
    if (!shelf) throw new NotFoundException('Shelf not found');
    this.assertOwner(shelf.rack.zone.warehouse.merchantId, merchantId);
    return this.prisma.warehouseCell.create({
      data: {
        shelfId,
        code: dto.code,
        cellType: dto.cellType,
        merchantId: dto.merchantId ?? null,
        maxWeightKg: dto.maxWeightKg?.toString(),
        qrCode: dto.qrCode ?? dto.code,
      },
    });
  }

  /** Плоский список ячеек склада (для размещения / выбора в UI). */
  async listCells(warehouseId: string, merchantId?: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh) throw new NotFoundException('Warehouse not found');
    this.assertOwner(wh.merchantId, merchantId);
    return this.prisma.warehouseCell.findMany({
      where: { shelf: { rack: { zone: { warehouseId } } } },
      orderBy: { code: 'asc' },
      include: { _count: { select: { inventoryBalances: true } } },
    });
  }

  private assertOwner(ownerMerchantId: string | null, merchantId?: string): void {
    // merchantId передан → контекст мерчанта: разрешаем только свои склады
    if (merchantId !== undefined && ownerMerchantId !== merchantId) {
      throw new ForbiddenException('Это не ваш склад');
    }
  }
}
