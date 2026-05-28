import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, VerificationPurpose } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { EmailService } from '../notifications/services/email.service';
import type { TemplateRendererService } from '../notifications/services/template-renderer.service';

import { AuthService } from './auth.service';
import type { PasswordService } from './password.service';
import type { TokensService } from './tokens.service';

describe('AuthService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let password: DeepMockProxy<PasswordService>;
  let tokens: DeepMockProxy<TokensService>;
  let email: DeepMockProxy<EmailService>;
  let templates: DeepMockProxy<TemplateRendererService>;
  let service: AuthService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    password = mockDeep<PasswordService>();
    tokens = mockDeep<TokensService>();
    email = mockDeep<EmailService>();
    templates = mockDeep<TemplateRendererService>();
    service = new AuthService(prisma, password, tokens, email, templates);
  });

  // ---------------------------------------------------------------------------
  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      password: 'Test1234!',
      firstName: 'Ivan',
      lastName: 'Petrov',
    };

    it('бросает ConflictException, если email уже занят', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' } as never);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('создаёт пользователя и отправляет код верификации', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u-new', email: dto.email } as never);
      password.hash.mockResolvedValue('hashed_pwd');
      // upsert verification:
      prisma.verificationCode.updateMany.mockResolvedValue({ count: 0 } as never);
      prisma.verificationCode.create.mockResolvedValue({} as never);
      templates.render.mockResolvedValue({ subject: 'Verify', body: 'Code: 123456' } as never);
      email.send.mockResolvedValue({} as never);

      const r = await service.register(dto);
      expect(r.userId).toBe('u-new');
      expect(password.hash).toHaveBeenCalledWith(dto.password);
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: dto.email, templateCode: 'email_verification' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('login', () => {
    const dto = { email: 'u@example.com', password: 'pwd123' };

    function userMock(
      overrides: Partial<{
        passwordHash: string | null;
        isActive: boolean;
        isEmailVerified: boolean;
        roles: Array<{ role: UserRole; merchantId: string | null }>;
      }> = {},
    ) {
      return {
        id: 'u1',
        email: dto.email,
        phone: null,
        firstName: 'A',
        lastName: 'B',
        passwordHash: 'hashed',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: false,
        roles: [{ role: UserRole.CUSTOMER, merchantId: null }],
        ...overrides,
      };
    }

    it('бросает UnauthorizedException если пользователя нет', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('бросает UnauthorizedException если нет passwordHash', async () => {
      prisma.user.findFirst.mockResolvedValue(userMock({ passwordHash: null }) as never);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('бросает ForbiddenException если аккаунт отключён', async () => {
      prisma.user.findFirst.mockResolvedValue(userMock({ isActive: false }) as never);
      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it('бросает ForbiddenException если email не подтверждён', async () => {
      prisma.user.findFirst.mockResolvedValue(userMock({ isEmailVerified: false }) as never);
      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it('бросает UnauthorizedException при неверном пароле', async () => {
      prisma.user.findFirst.mockResolvedValue(userMock() as never);
      password.verify.mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('возвращает токены и обновляет lastLoginAt при успехе', async () => {
      prisma.user.findFirst.mockResolvedValue(userMock() as never);
      password.verify.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({} as never);
      tokens.issue.mockResolvedValue({
        accessToken: 'ACC',
        refreshToken: 'REF',
        expiresIn: 900,
      } as never);

      const r = await service.login(dto, '127.0.0.1');
      expect(r.accessToken).toBe('ACC');
      expect(r.refreshToken).toBe('REF');
      expect(r.user.email).toBe(dto.email);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastLoginIp: '127.0.0.1' }),
        }),
      );
    });

    it('передаёт merchantId в payload токена для MERCHANT', async () => {
      prisma.user.findFirst.mockResolvedValue(
        userMock({
          roles: [{ role: UserRole.MERCHANT, merchantId: 'merch-1' }],
        }) as never,
      );
      password.verify.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({} as never);
      tokens.issue.mockResolvedValue({ accessToken: 'A', refreshToken: 'R', expiresIn: 900 } as never);

      await service.login(dto);
      expect(tokens.issue).toHaveBeenCalledWith(
        expect.objectContaining({ merchantId: 'merch-1', roles: [UserRole.MERCHANT] }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('refresh', () => {
    it('делегирует TokensService.rotate', async () => {
      tokens.rotate.mockResolvedValue({
        accessToken: 'A2',
        refreshToken: 'R2',
        expiresIn: 900,
      } as never);
      const r = await service.refresh('old-refresh', '10.0.0.1');
      expect(r.refreshToken).toBe('R2');
      expect(tokens.rotate).toHaveBeenCalledWith('old-refresh', '10.0.0.1');
    });

    it('маскирует ошибки rotate в UnauthorizedException', async () => {
      tokens.rotate.mockRejectedValue(new Error('whatever internal'));
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('requestPasswordReset', () => {
    it('не палит существование пользователя (всегда успех)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const r = await service.requestPasswordReset({ email: 'noone@x.uz' });
      expect(r.message).toMatch(/If the email exists/);
      expect(email.send).not.toHaveBeenCalled();
    });

    it('отправляет код если пользователь существует', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'x@x.uz' } as never);
      password.hash.mockResolvedValue('hashed_code');
      prisma.verificationCode.updateMany.mockResolvedValue({ count: 0 } as never);
      prisma.verificationCode.create.mockResolvedValue({} as never);
      templates.render.mockResolvedValue({ subject: 'Reset', body: 'Code: 000111' } as never);
      email.send.mockResolvedValue({} as never);

      await service.requestPasswordReset({ email: 'x@x.uz' });
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ templateCode: 'password_reset' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('confirmPasswordReset', () => {
    const dto = { email: 'x@x.uz', code: '123456', newPassword: 'NewPwd1234!' };

    it('меняет пароль и отзывает все refresh-токены', async () => {
      const codeRec = {
        id: 'c1',
        userId: 'u1',
        identifier: dto.email,
        codeHash: 'hashed',
        purpose: VerificationPurpose.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
      };
      prisma.verificationCode.findFirst.mockResolvedValue(codeRec as never);
      password.verify.mockResolvedValue(true);
      prisma.verificationCode.update.mockResolvedValue({} as never);
      password.hash.mockResolvedValue('new_hash');
      prisma.user.update.mockResolvedValue({} as never);
      tokens.revokeAllForUser.mockResolvedValue(undefined as never);

      await service.confirmPasswordReset(dto);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { passwordHash: 'new_hash' },
        }),
      );
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });
  });
});
