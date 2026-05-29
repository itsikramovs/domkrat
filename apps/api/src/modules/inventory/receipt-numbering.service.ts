import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class ReceiptNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Формат: RCP-2026-000001. Для MVP — max+1 по префиксу года.
   * Для production — отдельная sequence в БД.
   */
  async nextReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RCP-${year}-`;
    const last = await this.prisma.stockReceipt.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });
    const lastSeq = last ? Number(last.receiptNumber.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(6, '0')}`;
  }
}
