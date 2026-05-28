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

import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AdminFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [
      ordersCount,
      paidOrdersCount,
      shippedOrdersCount,
      completedOrdersCount,
      grossRevenue,
      pendingWithdrawals,
      merchantsCount,
      activeMerchantsCount,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PAID' } }),
      this.prisma.order.count({ where: { status: 'SHIPPED' } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        _sum: { paidAmount: true },
        where: { status: { in: ['PAID', 'PROCESSING', 'ASSEMBLED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] } },
      }),
      this.prisma.withdrawalRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.merchant.count({ where: { deletedAt: null } }),
      this.prisma.merchant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    ]);

    return {
      orders: {
        total: ordersCount,
        paid: paidOrdersCount,
        shipped: shippedOrdersCount,
        completed: completedOrdersCount,
      },
      revenue: { gross: (grossRevenue._sum.paidAmount ?? new Prisma.Decimal(0)).toString() },
      merchants: { total: merchantsCount, active: activeMerchantsCount },
      pendingWithdrawals,
    };
  }

  async listWithdrawals(filter: { status?: WithdrawalStatus; page?: number; perPage?: number }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);
    const where: Prisma.WithdrawalRequestWhereInput = {};
    if (filter.status) where.status = filter.status;
    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        include: { merchant: { select: { brandName: true, slug: true, contactEmail: true } } },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);
    return { data: items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async approveWithdrawal(id: string, adminId: string, notes?: string) {
    const wr = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!wr) throw new NotFoundException('Withdrawal not found');
    if (wr.status !== WithdrawalStatus.PENDING) {
      throw new ConflictException(`Cannot approve from status ${wr.status}`);
    }
    return this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: WithdrawalStatus.APPROVED,
        processedById: adminId,
        processedAt: new Date(),
        adminNotes: notes,
      },
    });
  }

  async rejectWithdrawal(id: string, adminId: string, reason: string) {
    if (!reason) throw new BadRequestException('Rejection reason is required');
    const wr = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!wr) throw new NotFoundException('Withdrawal not found');
    if (!['PENDING', 'APPROVED'].includes(wr.status)) {
      throw new ConflictException(`Cannot reject from status ${wr.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Возвращаем сумму на available_balance
      const balance = await tx.merchantBalance.findUnique({ where: { merchantId: wr.merchantId } });
      const newAvailable = new Decimal((balance?.availableBalance ?? new Prisma.Decimal(0)).toString())
        .plus(wr.amount.toString());

      await tx.merchantBalance.update({
        where: { merchantId: wr.merchantId },
        data: { availableBalance: newAvailable.toString() },
      });

      await tx.financialTransaction.create({
        data: {
          merchantId: wr.merchantId,
          transactionType: FinancialTransactionType.ADJUSTMENT,
          direction: TransactionDirection.CREDIT,
          amount: wr.amount,
          balanceAfter: newAvailable.toString(),
          referenceType: 'withdrawal',
          referenceId: wr.id,
          description: `Withdrawal rejected: ${reason}`,
          performedById: adminId,
        },
      });

      return tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: WithdrawalStatus.REJECTED,
          processedById: adminId,
          processedAt: new Date(),
          rejectionReason: reason,
        },
      });
    });
  }

  async completeWithdrawal(id: string, adminId: string, externalTransactionId: string) {
    const wr = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!wr) throw new NotFoundException('Withdrawal not found');
    if (wr.status !== WithdrawalStatus.APPROVED && wr.status !== WithdrawalStatus.PROCESSING) {
      throw new ConflictException(`Cannot complete from status ${wr.status}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.merchantBalance.findUnique({ where: { merchantId: wr.merchantId } });
      const newTotalWithdrawn = new Decimal((balance?.totalWithdrawn ?? new Prisma.Decimal(0)).toString())
        .plus(wr.amount.toString());

      await tx.merchantBalance.update({
        where: { merchantId: wr.merchantId },
        data: { totalWithdrawn: newTotalWithdrawn.toString() },
      });

      await tx.financialTransaction.create({
        data: {
          merchantId: wr.merchantId,
          transactionType: FinancialTransactionType.WITHDRAWAL,
          direction: TransactionDirection.DEBIT,
          amount: wr.amount,
          balanceAfter: (balance?.availableBalance ?? new Prisma.Decimal(0)).toString(),
          referenceType: 'withdrawal',
          referenceId: wr.id,
          description: `Withdrawal completed (ext: ${externalTransactionId})`,
          performedById: adminId,
        },
      });

      return tx.withdrawalRequest.update({
        where: { id },
        data: {
          status: WithdrawalStatus.COMPLETED,
          externalTransactionId,
        },
      });
    });
  }
}
