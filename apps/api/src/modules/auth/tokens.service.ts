import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import type { JwtPayload, TokenPair } from './types';

interface IssueTokensParams {
  userId: string;
  email: string | null;
  roles: UserRole[];
  merchantId: string | null;
  deviceInfo?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class TokensService {
  private readonly accessTtl: string;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.accessTtl = config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
    this.refreshTtlSeconds = this.parseDurationToSeconds(
      config.get<string>('JWT_REFRESH_EXPIRES') ?? '30d',
    );
  }

  async issue(params: IssueTokensParams): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: params.userId,
      email: params.email,
      roles: params.roles,
      merchantId: params.merchantId,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.accessTtl });

    const refreshToken = this.generateRefreshToken();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: params.userId,
        tokenHash,
        deviceInfo: params.deviceInfo as object | undefined,
        ipAddress: params.ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseDurationToSeconds(this.accessTtl),
    };
  }

  /**
   * Проверяет refresh token (по хэшу в БД), отзывает его и выпускает новые токены.
   * Реализует rotation: при каждом refresh выдаётся новый refresh token,
   * старый помечается revokedAt.
   */
  async rotate(refreshToken: string, ipAddress?: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: { select: { role: true, merchantId: true } },
          },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new Error('Invalid or expired refresh token');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const merchantId = stored.user.roles.find((r) => r.merchantId)?.merchantId ?? null;
    return this.issue({
      userId: stored.user.id,
      email: stored.user.email,
      roles: stored.user.roles.map((r) => r.role),
      merchantId,
      ipAddress,
    });
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationToSeconds(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
    if (!match) return Number(value); // fallback — assume seconds
    const num = Number(match[1]);
    switch (match[2]) {
      case 's':
        return num;
      case 'm':
        return num * 60;
      case 'h':
        return num * 3600;
      case 'd':
        return num * 86400;
      default:
        return num;
    }
  }
}
