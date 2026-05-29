import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttributeDataType, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  CreateAttributeDto,
  CreateAttributeGroupDto,
  UpdateAttributeDto,
  UpdateAttributeGroupDto,
} from '../dto/create-attribute.dto';

const ENUM_TYPES: AttributeDataType[] = [AttributeDataType.ENUM, AttributeDataType.MULTI_ENUM];

/**
 * Управление характеристиками товаров (атрибуты + группы атрибутов).
 * Атрибуты определяют фильтры каталога и спецификации карточки товара.
 */
@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================ Groups
  listGroups() {
    return this.prisma.attributeGroup.findMany({
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      include: { _count: { select: { attributes: true } } },
    });
  }

  async createGroup(dto: CreateAttributeGroupDto) {
    try {
      return await this.prisma.attributeGroup.create({
        data: {
          name: dto.name as unknown as Prisma.InputJsonValue,
          slug: dto.slug,
          position: dto.position ?? 0,
        },
      });
    } catch (error) {
      this.handleUniqueErr(error, 'group');
    }
  }

  async updateGroup(id: string, dto: UpdateAttributeGroupDto) {
    await this.getGroupOrFail(id);
    try {
      return await this.prisma.attributeGroup.update({
        where: { id },
        data: {
          name: dto.name as unknown as Prisma.InputJsonValue,
          slug: dto.slug,
          position: dto.position,
        },
      });
    } catch (error) {
      this.handleUniqueErr(error, 'group');
    }
  }

  /** Удаляет группу; атрибуты в ней остаются (attributeGroupId → null по SetNull). */
  async removeGroup(id: string): Promise<void> {
    await this.getGroupOrFail(id);
    await this.prisma.attributeGroup.delete({ where: { id } });
  }

  // ============================================================ Attributes
  listAttributes(params: { groupId?: string; categoryId?: string } = {}) {
    const where: Prisma.AttributeWhereInput = {};
    if (params.groupId) where.attributeGroupId = params.groupId;
    if (params.categoryId) where.categoryIds = { has: params.categoryId };

    return this.prisma.attribute.findMany({
      where,
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      include: {
        group: { select: { id: true, name: true, slug: true } },
        _count: { select: { productAttributes: true } },
      },
    });
  }

  async getAttribute(id: string) {
    const attr = await this.prisma.attribute.findUnique({
      where: { id },
      include: { group: { select: { id: true, name: true, slug: true } } },
    });
    if (!attr) throw new NotFoundException('Attribute not found');
    return attr;
  }

  async createAttribute(dto: CreateAttributeDto) {
    this.assertEnumValues(dto.dataType, dto.enumValues);
    await this.assertGroupExists(dto.attributeGroupId);

    try {
      return await this.prisma.attribute.create({
        data: {
          name: dto.name as unknown as Prisma.InputJsonValue,
          slug: dto.slug,
          code: dto.code,
          dataType: dto.dataType,
          unit: dto.unit,
          isFilterable: dto.isFilterable ?? true,
          isSearchable: dto.isSearchable ?? false,
          isRequired: dto.isRequired ?? false,
          position: dto.position ?? 0,
          attributeGroupId: dto.attributeGroupId,
          categoryIds: dto.categoryIds ?? [],
          enumValues: this.serializeEnum(dto.dataType, dto.enumValues),
        },
      });
    } catch (error) {
      this.handleUniqueErr(error, 'attribute');
    }
  }

  async updateAttribute(id: string, dto: UpdateAttributeDto) {
    const existing = await this.getAttribute(id);
    const dataType = dto.dataType ?? existing.dataType;

    // Проверяем enumValues только если меняется тип или передан список опций.
    if (dto.dataType !== undefined || dto.enumValues !== undefined) {
      const values = dto.enumValues ?? (existing.enumValues as unknown as []);
      this.assertEnumValues(dataType, values);
    }
    if (dto.attributeGroupId !== undefined) await this.assertGroupExists(dto.attributeGroupId);

    try {
      return await this.prisma.attribute.update({
        where: { id },
        data: {
          name: dto.name as unknown as Prisma.InputJsonValue,
          slug: dto.slug,
          code: dto.code,
          dataType: dto.dataType,
          unit: dto.unit,
          isFilterable: dto.isFilterable,
          isSearchable: dto.isSearchable,
          isRequired: dto.isRequired,
          position: dto.position,
          attributeGroupId: dto.attributeGroupId,
          categoryIds: dto.categoryIds,
          enumValues:
            dto.dataType === undefined && dto.enumValues === undefined
              ? undefined
              : this.serializeEnum(dataType, dto.enumValues),
        },
      });
    } catch (error) {
      this.handleUniqueErr(error, 'attribute');
    }
  }

  /** Удаляет атрибут. Блокирует удаление, если атрибут заполнен у товаров (иначе тихая потеря данных). */
  async removeAttribute(id: string): Promise<void> {
    await this.getAttribute(id);
    const usage = await this.prisma.productAttribute.count({ where: { attributeId: id } });
    if (usage > 0) {
      throw new ConflictException(
        `Атрибут используется у ${usage} товаров — сначала очистите значения`,
      );
    }
    await this.prisma.attribute.delete({ where: { id } });
  }

  // ============================================================ Helpers
  private async getGroupOrFail(id: string) {
    const group = await this.prisma.attributeGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Attribute group not found');
    return group;
  }

  private async assertGroupExists(groupId?: string | null): Promise<void> {
    if (!groupId) return;
    const group = await this.prisma.attributeGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new BadRequestException('Attribute group not found');
  }

  private assertEnumValues(dataType: AttributeDataType, values: unknown): void {
    if (ENUM_TYPES.includes(dataType)) {
      if (!Array.isArray(values) || values.length === 0) {
        throw new BadRequestException('ENUM/MULTI_ENUM требует непустой список опций (enumValues)');
      }
    }
  }

  private serializeEnum(
    dataType: AttributeDataType,
    values?: unknown,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!ENUM_TYPES.includes(dataType)) return Prisma.JsonNull;
    return (values ?? []) as Prisma.InputJsonValue;
  }

  private handleUniqueErr(error: unknown, entity: 'group' | 'attribute'): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const label = entity === 'group' ? 'Группа атрибутов' : 'Атрибут';
      throw new ConflictException(`${label} с таким slug уже существует`);
    }
    throw error as Error;
  }
}
