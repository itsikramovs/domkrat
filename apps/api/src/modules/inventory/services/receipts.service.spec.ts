import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReceiptStatus, WarehouseType } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ReceiptNumberingService } from '../receipt-numbering.service';

import { ReceiptsService } from './receipts.service';

describe('ReceiptsService — guards', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let numbering: DeepMockProxy<ReceiptNumberingService>;
  let service: ReceiptsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    numbering = mockDeep<ReceiptNumberingService>();
    service = new ReceiptsService(prisma, numbering);
  });

  const baseCreateDto = {
    warehouseId: 'wh-1',
    items: [{ productId: 'p-1', expectedQuantity: 10 }],
  };

  it('create: бросает NotFound, если склад не найден', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(null);
    await expect(service.create('m-1', baseCreateDto)).rejects.toThrow(NotFoundException);
  });

  it('create: бросает Forbidden для чужого не-платформенного склада', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'wh-1',
      merchantId: 'other',
      type: WarehouseType.MERCHANT,
    } as never);
    await expect(service.create('m-1', baseCreateDto)).rejects.toThrow(ForbiddenException);
  });

  it('create: бросает BadRequest, если товары не принадлежат мерчанту', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'wh-1',
      merchantId: 'm-1',
      type: WarehouseType.MERCHANT,
    } as never);
    prisma.product.count.mockResolvedValue(0); // ни один товар не принадлежит
    await expect(service.create('m-1', baseCreateDto)).rejects.toThrow(BadRequestException);
  });

  it('submit: бросает Conflict при неверном статусе (не DRAFT)', async () => {
    prisma.stockReceipt.findUnique.mockResolvedValue({
      id: 'r-1',
      merchantId: 'm-1',
      status: ReceiptStatus.EXPECTED,
      items: [],
    } as never);
    await expect(service.submit('r-1', 'm-1')).rejects.toThrow(ConflictException);
  });

  it('submit: бросает Forbidden для чужой приёмки', async () => {
    prisma.stockReceipt.findUnique.mockResolvedValue({
      id: 'r-1',
      merchantId: 'other',
      status: ReceiptStatus.DRAFT,
      items: [],
    } as never);
    await expect(service.submit('r-1', 'm-1')).rejects.toThrow(ForbiddenException);
  });

  it('qualityCheck: бросает BadRequest, если принято+брак больше принятого по факту', async () => {
    prisma.stockReceipt.findUnique.mockResolvedValue({
      id: 'r-1',
      merchantId: 'm-1',
      status: ReceiptStatus.ARRIVED,
      items: [{ id: 'it-1', receivedQuantity: 10 }],
    } as never);
    await expect(
      service.qualityCheck('r-1', 'm-1', {
        items: [{ itemId: 'it-1', acceptedQuantity: 9, rejectedQuantity: 3 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
