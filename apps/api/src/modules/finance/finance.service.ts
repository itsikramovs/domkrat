import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialTransactionType,
  Prisma,
  TransactionDirection,
  WithdrawalStatus,
} from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface CreateWithdrawalInput {
  amount: number | string;
  bankAccount: string;
  bankName: string;
  bankMfo?: string;
  recipientName: string;
  notes?: string;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(merchantId: string) {
    const balance = await this.prisma.merchantBalance.findUnique({ where: { merchantId } });
    if (!balance) {
      // Auto-create если не было
      return this.prisma.merchantBalance.create({ data: { merchantId } });
    }
    return balance;
  }

  listTransactions(merchantId: string, page = 1, perPage = 50) {
    return this.prisma.financialTransaction.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: Math.min(perPage, 100),
    });
  }

  listWithdrawals(merchantId: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: { merchantId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async createWithdrawal(merchantId: string, dto: CreateWithdrawalInput) {
    const amount = new Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('Amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.merchantBalance.findUnique({ where: { merchantId } });
      if (!balance) throw new NotFoundException('Merchant balance not found');

      const available = new Decimal(balance.availableBalance.toString());
      if (available.lessThan(amount)) {
        throw new ConflictException(
          `Insufficient available balance: have ${available.toString()}, requested ${amount.toString()}`,
        );
      }

      const newAvailable = available.minus(amount);

      const requestNumber = await this.nextWithdrawalNumber(tx);
      const wr = await tx.withdrawalRequest.create({
        data: {
          requestNumber,
          merchantId,
          amount: amount.toString(),
          bankAccount: dto.bankAccount,
          bankName: dto.bankName,
          bankMfo: dto.bankMfo,
          recipientName: dto.recipientName,
          notes: dto.notes,
          status: WithdrawalStatus.PENDING,
        },
      });

      // Резервируем сумму: уменьшаем available
      await tx.merchantBalance.update({
        where: { merchantId },
        data: { availableBalance: newAvailable.toString() },
      });

      await tx.financialTransaction.create({
        data: {
          merchantId,
          transactionType: FinancialTransactionType.ADJUSTMENT,
          direction: TransactionDirection.DEBIT,
          amount: amount.toString(),
          balanceAfter: newAvailable.toString(),
          referenceType: 'withdrawal',
          referenceId: wr.id,
          description: `Withdrawal requested ${requestNumber}`,
        },
      });

      return wr;
    });
  }

  private async nextWithdrawalNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WD-${year}-`;
    const last = await tx.withdrawalRequest.findFirst({
      where: { requestNumber: { startsWith: prefix } },
      orderBy: { requestNumber: 'desc' },
      select: { requestNumber: true },
    });
    const lastSeq = last ? Number(last.requestNumber.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(5, '0')}`;
  }
}
