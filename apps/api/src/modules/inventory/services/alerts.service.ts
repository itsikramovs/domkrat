import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertSeverity, AlertStatus, AlertType, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

const LOW_STOCK_THRESHOLD = 5;
const DAY_MS = 86_400_000;

/**
 * Мониторинг хранения (шаг 7 §3.1): ежедневный скан остатков → InventoryAlert.
 * - LOW_STOCK / OUT_OF_STOCK по агрегату (cellId null)
 * - STALE_STOCK_30D/60D/90D по oldestReceivedAt в ячейках
 * Гранулярность — по предложению (offer = продавец × вариант): в маркетплейс-модели
 * у одной карточки/продавца может быть несколько вариантов с разным остатком.
 * Дедуп: один ACTIVE-алерт на (offer, type). Пополнение авто-resolve'ит low/out.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduled(): Promise<void> {
    const { created } = await this.scan();
    this.logger.log(`Inventory scan: ${created} новых алертов`);
  }

  /** Полный скан. Возвращает число созданных алертов. */
  async scan(): Promise<{ created: number }> {
    let created = 0;

    // 1. Доступность к продаже (агрегат cellId = null) — по предложению (offer)
    const aggregates = await this.prisma.inventoryBalance.findMany({
      where: { cellId: null },
      select: {
        offerId: true,
        productId: true,
        variantId: true,
        merchantId: true,
        quantityAvailable: true,
      },
    });
    for (const b of aggregates) {
      if (b.quantityAvailable <= 0) {
        await this.autoResolve(b.offerId, [AlertType.LOW_STOCK]);
        created += await this.ensure(b, AlertType.OUT_OF_STOCK, AlertSeverity.CRITICAL, {
          ru: 'Нет в наличии',
          uz: 'Mavjud emas',
        });
      } else if (b.quantityAvailable <= LOW_STOCK_THRESHOLD) {
        await this.autoResolve(b.offerId, [AlertType.OUT_OF_STOCK]);
        created += await this.ensure(b, AlertType.LOW_STOCK, AlertSeverity.WARNING, {
          ru: `Заканчивается: ${b.quantityAvailable} шт`,
          uz: `Tugayapti: ${b.quantityAvailable} dona`,
        });
      } else {
        await this.autoResolve(b.offerId, [AlertType.LOW_STOCK, AlertType.OUT_OF_STOCK]);
      }
    }

    // 2. Залежавшийся товар (по ячейкам, oldestReceivedAt) — по предложению
    const cellBalances = await this.prisma.inventoryBalance.findMany({
      where: {
        cellId: { not: null },
        quantityAvailable: { gt: 0 },
        oldestReceivedAt: { not: null },
      },
      select: {
        offerId: true,
        productId: true,
        variantId: true,
        merchantId: true,
        oldestReceivedAt: true,
      },
    });
    const seen = new Set<string>();
    for (const b of cellBalances) {
      if (seen.has(b.offerId)) continue; // один алерт на предложение
      seen.add(b.offerId);
      const days = (Date.now() - b.oldestReceivedAt!.getTime()) / DAY_MS;
      if (days >= 90) {
        created += await this.ensure(b, AlertType.STALE_STOCK_90D, AlertSeverity.CRITICAL, {
          ru: 'Лежит на складе > 90 дней',
          uz: 'Omborda 90 kundan ortiq',
        });
      } else if (days >= 60) {
        created += await this.ensure(b, AlertType.STALE_STOCK_60D, AlertSeverity.WARNING, {
          ru: 'Лежит на складе > 60 дней',
          uz: 'Omborda 60 kundan ortiq',
        });
      } else if (days >= 30) {
        created += await this.ensure(b, AlertType.STALE_STOCK_30D, AlertSeverity.WARNING, {
          ru: 'Лежит на складе > 30 дней',
          uz: 'Omborda 30 kundan ortiq',
        });
      }
    }

    return { created };
  }

  list(merchantId: string, status: AlertStatus = AlertStatus.ACTIVE) {
    return this.prisma.inventoryAlert.findMany({
      where: { merchantId, status },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: { product: { select: { name: true } }, offer: { select: { sku: true } } },
    });
  }

  listAll(status: AlertStatus = AlertStatus.ACTIVE) {
    return this.prisma.inventoryAlert.findMany({
      where: { status },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      include: {
        product: { select: { name: true } },
        offer: { select: { sku: true } },
        merchant: { select: { brandName: true } },
      },
    });
  }

  async setStatus(id: string, merchantId: string, status: AlertStatus, userId: string) {
    const a = await this.prisma.inventoryAlert.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Алерт не найден');
    if (a.merchantId !== merchantId) throw new ForbiddenException('Чужой алерт');
    return this.prisma.inventoryAlert.update({
      where: { id },
      data: { status, resolvedAt: new Date(), resolvedById: userId },
    });
  }

  private async ensure(
    ref: { offerId: string; productId: string; variantId: string | null; merchantId: string },
    alertType: AlertType,
    severity: AlertSeverity,
    message: { ru: string; uz: string },
  ): Promise<number> {
    const existing = await this.prisma.inventoryAlert.findFirst({
      where: { offerId: ref.offerId, alertType, status: AlertStatus.ACTIVE },
      select: { id: true },
    });
    if (existing) return 0;
    await this.prisma.inventoryAlert.create({
      data: {
        offerId: ref.offerId,
        productId: ref.productId,
        variantId: ref.variantId,
        merchantId: ref.merchantId,
        alertType,
        severity,
        message: message as unknown as Prisma.InputJsonValue,
        status: AlertStatus.ACTIVE,
      },
    });
    return 1;
  }

  private async autoResolve(offerId: string, types: AlertType[]): Promise<void> {
    await this.prisma.inventoryAlert.updateMany({
      where: { offerId, alertType: { in: types }, status: AlertStatus.ACTIVE },
      data: { status: AlertStatus.RESOLVED, resolvedAt: new Date() },
    });
  }
}
