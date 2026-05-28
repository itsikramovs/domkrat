import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import type { CreateGarageDto, UpdateGarageDto } from './dto/garage.dto';

@Injectable()
export class GaragesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userGarage.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      include: {
        carModification: {
          include: {
            generation: { include: { model: { include: { make: true } } } },
            engine: true,
          },
        },
      },
    });
  }

  async get(userId: string, id: string) {
    const garage = await this.prisma.userGarage.findFirst({ where: { id, userId } });
    if (!garage) throw new NotFoundException('Garage entry not found');
    return garage;
  }

  async create(userId: string, dto: CreateGarageDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.userGarage.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.userGarage.create({
        data: {
          userId,
          ...dto,
          engineVolume:
            dto.engineVolume !== undefined ? new Prisma.Decimal(dto.engineVolume) : null,
          mileageUpdatedAt: dto.mileage !== undefined ? new Date() : null,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateGarageDto) {
    await this.ensureOwnership(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.userGarage.updateMany({
          where: { userId, isPrimary: true, NOT: { id } },
          data: { isPrimary: false },
        });
      }
      return tx.userGarage.update({
        where: { id },
        data: {
          ...dto,
          engineVolume:
            dto.engineVolume !== undefined ? new Prisma.Decimal(dto.engineVolume) : undefined,
          mileageUpdatedAt: dto.mileage !== undefined ? new Date() : undefined,
        },
      });
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.ensureOwnership(userId, id);
    await this.prisma.userGarage.delete({ where: { id } });
  }

  private async ensureOwnership(userId: string, id: string): Promise<void> {
    const g = await this.prisma.userGarage.findUnique({ where: { id }, select: { userId: true } });
    if (!g) throw new NotFoundException('Garage entry not found');
    if (g.userId !== userId) throw new ForbiddenException('Not your garage entry');
  }
}
