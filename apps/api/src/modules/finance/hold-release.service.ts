import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  FinancialTransactionType,
  OrderStatus,
  Prisma,
  TransactionDirection,
} from '@prisma/client';
import Decimal from 'decimal.js';

import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Перевод pending_balance → available_balance после hold period.
 *
 * Логика: для каждого sub_order COMPLETED, у которого completedAt + HOLD_DAYS < now,
 * сумма merchantPayout переходит из pending в available. Помечаем completed sub_order
 * как processed через временную метку в shipped_at? Нет, лучше — отдельная запись
 * в financial_transactions с referenceType='hold_release' + referenceId=subOrder.id.
 * Перед переводом проверяем что такая запись ещё не создана (идемпотентность).
 *
 * HOLD_DAYS — env (default 7). Для тестирования можно поставить 0.
 */
@Injectable()
export class HoldReleaseService {
  private readonly logger = new Logger(HoldReleaseService.name);
  private readonly holdDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.holdDays = Number(config.get<string>('HOLD_DAYS') ?? 7);
    this.logger.log(`Hold release period: ${this.holdDays} day(s)`);
  }

  /** Запускается каждые 5 минут */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduled(): Promise<void> {
    try {
      const result = await this.releaseEligible();
      if (result.released > 0) {
        this.logger.log(
          `Hold release: ${result.released} sub-order(s), total ${result.amount} UZS`,
        );
      }
    } catch (error) {
      this.logger.error(`Hold release failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /** Можно вызвать вручную из admin endpoint или test. */
  async releaseEligible(): Promise<{ released: number; amount: string }> {
    const threshold = new Date(Date.now() - this.holdDays * 86400_000);

    // Берём COMPLETED sub-orders где completedAt <= threshold
    // и для которых ещё нет hold_release financial_transaction.
    const candidates = await this.prisma.orderSubOrder.findMany({
      where: {
        status: OrderStatus.COMPLETED,
        completedAt: { lte: threshold, not: null },
      },
      select: { id: true, merchantId: true, merchantPayout: true, subOrderNumber: true },
    });

    let released = 0;
    let totalAmount = new Decimal(0);

    for (const sub of candidates) {
      const existing = await this.prisma.financialTransaction.findFirst({
        where: {
          merchantId: sub.merchantId,
          referenceType: 'hold_release',
          referenceId: sub.id,
        },
      });
      if (existing) continue;

      const payout = new Decimal(sub.merchantPayout.toString());
      if (payout.lessThanOrEqualTo(0)) continue;

      await this.prisma.$transaction(async (tx) => {
        const balance = await tx.merchantBalance.findUnique({ where: { merchantId: sub.merchantId } });
        if (!balance) return;

        const pending = new Decimal(balance.pendingBalance.toString());
        if (pending.lessThan(payout)) {
          this.logger.warn(
            `Pending balance ${pending} < payout ${payout} for ${sub.subOrderNumber} — skipping`,
          );
          return;
        }

        const newPending = pending.minus(payout);
        const newAvailable = new Decimal(balance.availableBalance.toString()).plus(payout);

        await tx.merchantBalance.update({
          where: { merchantId: sub.merchantId },
          data: {
            pendingBalance: newPending.toString(),
            availableBalance: newAvailable.toString(),
          },
        });

        await tx.financialTransaction.create({
          data: {
            merchantId: sub.merchantId,
            transactionType: FinancialTransactionType.ADJUSTMENT,
            direction: TransactionDirection.CREDIT,
            amount: payout.toString(),
            balanceAfter: newAvailable.toString(),
            referenceType: 'hold_release',
            referenceId: sub.id,
            description: `Hold release for ${sub.subOrderNumber} (${this.holdDays}d period)`,
          },
        });
      });

      released++;
      totalAmount = totalAmount.plus(payout);
    }

    return { released, amount: totalAmount.toString() };
  }
}
