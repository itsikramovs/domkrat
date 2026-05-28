import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, VerificationPurpose } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EmailService } from '../notifications/services/email.service';
import { TemplateRendererService } from '../notifications/services/template-renderer.service';

import type { LoginDto } from './dto/login.dto';
import type { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import type { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import { PasswordService } from './password.service';
import { TokensService } from './tokens.service';
import type { TokenPair, UserResponse } from './types';

const VERIFICATION_CODE_TTL_MIN = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokensService,
    private readonly email: EmailService,
    private readonly templates: TemplateRendererService,
  ) {}

  // -------------------------------------------------------------------------
  async register(dto: RegisterDto): Promise<{ userId: string; message: string; expiresIn: number }> {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.password.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isEmailVerified: false,
        roles: { create: [{ role: UserRole.CUSTOMER }] },
      },
    });

    await this.issueAndSendVerificationCode(dto.email, VerificationPurpose.REGISTRATION, user.id);

    return {
      userId: user.id,
      message: 'Verification code sent to your email',
      expiresIn: VERIFICATION_CODE_TTL_MIN * 60,
    };
  }

  // -------------------------------------------------------------------------
  async verifyEmail(dto: VerifyEmailDto, ipAddress?: string): Promise<TokenPair & { user: UserResponse }> {
    const code = await this.consumeVerificationCode(
      dto.email,
      dto.code,
      VerificationPurpose.REGISTRATION,
    );
    if (!code.userId) throw new BadRequestException('Verification code has no associated user');

    const user = await this.prisma.user.update({
      where: { id: code.userId },
      data: { isEmailVerified: true },
      include: { roles: { select: { role: true, merchantId: true } } },
    });

    const merchantId = user.roles.find((r) => r.merchantId)?.merchantId ?? null;
    const tokens = await this.tokens.issue({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role),
      merchantId,
      ipAddress,
    });

    return { ...tokens, user: this.toUserResponse(user) };
  }

  // -------------------------------------------------------------------------
  async login(dto: LoginDto, ipAddress?: string): Promise<TokenPair & { user: UserResponse }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: { roles: { select: { role: true, merchantId: true } } },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }
    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    const ok = await this.password.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
    });

    const merchantId = user.roles.find((r) => r.merchantId)?.merchantId ?? null;
    const tokens = await this.tokens.issue({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role),
      merchantId,
      ipAddress,
    });

    return { ...tokens, user: this.toUserResponse(user) };
  }

  // -------------------------------------------------------------------------
  refresh(refreshToken: string, ipAddress?: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, ipAddress).catch((error) => {
      this.logger.warn(`Refresh failed: ${error instanceof Error ? error.message : error}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  // -------------------------------------------------------------------------
  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    // Не палим, существует пользователь или нет (защита от перебора)
    if (user) {
      await this.issueAndSendVerificationCode(dto.email, VerificationPurpose.PASSWORD_RESET, user.id);
    }
    return { message: 'If the email exists, a reset code has been sent' };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto): Promise<{ message: string }> {
    const code = await this.consumeVerificationCode(
      dto.email,
      dto.code,
      VerificationPurpose.PASSWORD_RESET,
    );
    if (!code.userId) throw new BadRequestException('Verification code has no associated user');

    const newHash = await this.password.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: code.userId },
      data: { passwordHash: newHash },
    });

    // Безопасность: отзываем все refresh-токены
    await this.tokens.revokeAllForUser(code.userId);

    return { message: 'Password updated' };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async issueAndSendVerificationCode(
    email: string,
    purpose: VerificationPurpose,
    userId?: string,
  ): Promise<void> {
    const code = this.generateCode();
    const codeHash = await this.password.hash(code);

    // Деактивируем предыдущие активные коды для этого identifier+purpose
    await this.prisma.verificationCode.updateMany({
      where: { identifier: email, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.verificationCode.create({
      data: {
        userId,
        identifier: email,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MIN * 60_000),
      },
    });

    const templateCode = purpose === VerificationPurpose.REGISTRATION ? 'email_verification' : 'password_reset';
    const rendered = await this.templates.render(templateCode, { code }, 'ru');

    await this.email.send({
      to: email,
      subject: rendered.subject,
      body: rendered.body,
      userId,
      templateCode,
    });
  }

  private async consumeVerificationCode(
    identifier: string,
    code: string,
    purpose: VerificationPurpose,
  ) {
    const record = await this.prisma.verificationCode.findFirst({
      where: { identifier, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new NotFoundException('Verification code not found');
    if (record.expiresAt < new Date()) {
      throw new GoneException('Verification code expired');
    }
    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      throw new ForbiddenException('Too many attempts');
    }

    const valid = await this.password.verify(record.codeHash, code);
    if (!valid) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return record;
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private toUserResponse(user: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    roles: Array<{ role: UserRole }>;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((r) => r.role),
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    };
  }
}
