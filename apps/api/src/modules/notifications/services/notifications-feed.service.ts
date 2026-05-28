import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class NotificationsFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, params: { page?: number; perPage?: number; unreadOnly?: boolean }) {
    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 30, 100);
    const where = {
      userId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          templateCode: true,
          channel: true,
          subject: true,
          body: true,
          metadata: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { data: items, meta: { page, perPage, total, unreadCount } };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, id: string): Promise<{ id: string; readAt: Date }> {
    const n = await this.prisma.notification.findUnique({ where: { id }, select: { userId: true } });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.userId !== userId) throw new ForbiddenException('Not your notification');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      select: { id: true, readAt: true },
    });
    return { id: updated.id, readAt: updated.readAt! };
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const r = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: r.count };
  }
}
