import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import type { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(userId: string, id: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async create(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.userAddress.create({
        data: {
          userId,
          title: dto.title,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          region: dto.region,
          city: dto.city,
          district: dto.district,
          addressLine: dto.addressLine,
          landmark: dto.landmark,
          latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : null,
          longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : null,
          isDefault: dto.isDefault ?? false,
          isLegalEntity: dto.isLegalEntity ?? false,
          companyName: dto.companyName,
          taxId: dto.taxId,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.ensureOwnership(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.userAddress.update({
        where: { id },
        data: {
          ...dto,
          latitude: dto.latitude !== undefined ? new Prisma.Decimal(dto.latitude) : undefined,
          longitude: dto.longitude !== undefined ? new Prisma.Decimal(dto.longitude) : undefined,
        },
      });
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.ensureOwnership(userId, id);
    await this.prisma.userAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async setDefault(userId: string, id: string) {
    await this.ensureOwnership(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
      return tx.userAddress.update({ where: { id }, data: { isDefault: true } });
    });
  }

  private async ensureOwnership(userId: string, id: string): Promise<void> {
    const address = await this.prisma.userAddress.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not your address');
  }
}
