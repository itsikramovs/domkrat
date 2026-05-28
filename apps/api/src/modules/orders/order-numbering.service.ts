import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class OrderNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Формат: DK-2026-000001
   * Для MVP — последовательность из max(order_number).
   * Для production — отдельная sequence в БД (CREATE SEQUENCE order_seq).
   */
  async nextOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DK-${year}-`;
    const last = await this.prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const lastSeq = last ? Number(last.orderNumber.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(6, '0')}`;
  }

  async nextSubOrderNumber(orderNumber: string, merchantIndex: number): Promise<string> {
    return `${orderNumber}-M${merchantIndex + 1}`;
  }
}
