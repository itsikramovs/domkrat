import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  MerchantStatus,
  Prisma,
  UserRole,
  VerificationStatus,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from '../../auth/password.service';
import type { CreateMerchantDto } from '../dto/create-merchant.dto';

@Injectable()
export class AdminMerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

  /**
   * Создаёт мерчанта администратором: владелец (User+роль MERCHANT) и компания (Merchant)
   * в одной транзакции. Мерчант сразу ACTIVE/APPROVED — без email-верификации.
   * @throws {ConflictException} если email/телефон владельца уже заняты
   */
  async create(dto: CreateMerchantDto, adminId: string) {
    const emailOwner = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (emailOwner) throw new ConflictException('Пользователь с таким email уже существует');
    if (dto.ownerPhone) {
      const phoneOwner = await this.prisma.user.findUnique({ where: { phone: dto.ownerPhone } });
      if (phoneOwner) throw new ConflictException('Пользователь с таким телефоном уже существует');
    }

    const slug = await this.uniqueSlug(dto.slug ?? this.slugify(dto.brandName));
    const passwordHash = await this.password.hash(dto.ownerPassword);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.ownerEmail,
          phone: dto.ownerPhone,
          passwordHash,
          firstName: dto.ownerFirstName,
          lastName: dto.ownerLastName,
          isEmailVerified: true, // создан админом — доверенный
          isPhoneVerified: Boolean(dto.ownerPhone),
          preferredLanguage: 'ru',
        },
      });

      const merchant = await tx.merchant.create({
        data: {
          userId: user.id,
          merchantType: dto.merchantType,
          legalType: dto.legalType,
          legalName: dto.legalName,
          brandName: dto.brandName,
          slug,
          taxId: dto.taxId,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          status: MerchantStatus.ACTIVE,
          verificationStatus: VerificationStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedById: adminId,
        },
      });

      await tx.userRoleAssignment.create({
        data: { userId: user.id, role: UserRole.MERCHANT, merchantId: merchant.id },
      });
      await tx.merchantBalance.create({ data: { merchantId: merchant.id } });

      return {
        id: merchant.id,
        slug: merchant.slug,
        brandName: merchant.brandName,
        status: merchant.status,
        owner: { id: user.id, email: user.email },
      };
    });
  }

  private slugify(input: string): string {
    const base = input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'merchant';
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let i = 1;
    // slug @unique — добиваем суффиксом, пока занято
    while (await this.prisma.merchant.findUnique({ where: { slug } })) {
      i += 1;
      slug = `${base}-${i}`;
    }
    return slug;
  }

  async list(filter: {
    status?: MerchantStatus;
    verificationStatus?: VerificationStatus;
    search?: string;
    page?: number;
    perPage?: number;
  }) {
    const page = filter.page ?? 1;
    const perPage = Math.min(filter.perPage ?? 20, 100);
    const where: Prisma.MerchantWhereInput = { deletedAt: null };
    if (filter.status) where.status = filter.status;
    if (filter.verificationStatus) where.verificationStatus = filter.verificationStatus;
    if (filter.search) {
      where.OR = [
        { brandName: { contains: filter.search, mode: 'insensitive' } },
        { legalName: { contains: filter.search, mode: 'insensitive' } },
        { slug: { contains: filter.search, mode: 'insensitive' } },
        { taxId: { contains: filter.search } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        include: {
          user: { select: { email: true, phone: true, firstName: true, lastName: true } },
          balance: true,
          _count: { select: { products: true, documents: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.merchant.count({ where }),
    ]);
    return { data: items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async get(id: string) {
    const m = await this.prisma.merchant.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        balance: true,
        documents: { orderBy: { uploadedAt: 'desc' } },
        contracts: true,
        _count: { select: { products: true } },
      },
    });
    if (!m) throw new NotFoundException('Merchant not found');
    return m;
  }

  async approve(id: string, verifiedById: string, notes?: string) {
    const m = await this.prisma.merchant.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Merchant not found');
    if (m.status === MerchantStatus.ACTIVE) {
      throw new ConflictException('Merchant is already active');
    }
    return this.prisma.merchant.update({
      where: { id },
      data: {
        status: MerchantStatus.ACTIVE,
        verificationStatus: VerificationStatus.APPROVED,
        verifiedAt: new Date(),
        verifiedById,
        ...(notes ? {} : {}),
      },
    });
  }

  async reject(id: string, verifiedById: string, reason: string) {
    if (!reason) throw new BadRequestException('Reason is required');
    return this.prisma.merchant.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        verifiedAt: new Date(),
        verifiedById,
      },
    });
  }

  async suspend(id: string, until?: Date) {
    return this.prisma.merchant.update({
      where: { id },
      data: {
        status: MerchantStatus.SUSPENDED,
        suspendedUntil: until ?? null,
      },
    });
  }

  async ban(id: string) {
    return this.prisma.merchant.update({
      where: { id },
      data: { status: MerchantStatus.BANNED, isActive: false },
    });
  }

  // -------- Documents --------
  listDocuments(merchantId: string) {
    return this.prisma.merchantDocument.findMany({
      where: { merchantId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async reviewDocument(docId: string, reviewerId: string, status: DocumentStatus, notes?: string) {
    const doc = await this.prisma.merchantDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.merchantDocument.update({
      where: { id: docId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        reviewNotes: notes,
      },
    });
  }
}
