import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  listMakes(onlyPopular = false) {
    return this.prisma.carMake.findMany({
      where: onlyPopular ? { isPopular: true } : undefined,
      orderBy: [{ isPopular: 'desc' }, { position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, logoUrl: true, isPopular: true },
    });
  }

  async listModels(makeId: string) {
    const exists = await this.prisma.carMake.findUnique({ where: { id: makeId } });
    if (!exists) throw new NotFoundException('Make not found');
    return this.prisma.carModel.findMany({
      where: { makeId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, bodyType: true, imageUrl: true },
    });
  }

  async listGenerations(modelId: string) {
    const exists = await this.prisma.carModel.findUnique({ where: { id: modelId } });
    if (!exists) throw new NotFoundException('Model not found');
    return this.prisma.carGeneration.findMany({
      where: { modelId },
      orderBy: { yearFrom: 'desc' },
      select: { id: true, name: true, yearFrom: true, yearTo: true, restylingYear: true },
    });
  }

  async listModifications(generationId: string) {
    const exists = await this.prisma.carGeneration.findUnique({ where: { id: generationId } });
    if (!exists) throw new NotFoundException('Generation not found');
    return this.prisma.carModification.findMany({
      where: { generationId },
      orderBy: { name: 'asc' },
      include: { engine: { select: { name: true, displacement: true } } },
    });
  }

  /**
   * Резолв VIN → carModification.
   * MVP: ищем VIN в UserGarage (любого пользователя). Реальный VIN-decoder API подключится позже.
   * Если совпадения нет — возвращаем null, фронт покажет каскадный выбор вручную.
   */
  async resolveVin(vin: string) {
    const normalized = vin.trim().toUpperCase();
    if (normalized.length < 11) return null;
    const garage = await this.prisma.userGarage.findFirst({
      where: { vin: normalized },
      include: {
        carModification: {
          include: {
            generation: { include: { model: { include: { make: true } } } },
            engine: { select: { name: true, displacement: true } },
          },
        },
      },
    });
    if (!garage?.carModification) return null;
    return {
      vin: normalized,
      carModification: garage.carModification,
    };
  }
}
