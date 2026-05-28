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
  VerificationStatus,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AdminMerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { status?: MerchantStatus; verificationStatus?: VerificationStatus; search?: string; page?: number; perPage?: number }) {
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
