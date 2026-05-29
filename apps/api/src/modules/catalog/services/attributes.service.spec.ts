import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AttributeDataType, Prisma } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';

import type { PrismaService } from '../../../infrastructure/database/prisma.service';

import { AttributesService } from './attributes.service';
import type { CreateAttributeDto } from '../dto/create-attribute.dto';

describe('AttributesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: AttributesService;

  const baseDto = (overrides: Partial<CreateAttributeDto> = {}): CreateAttributeDto => ({
    name: { ru: 'Ширина', uz: 'Eni' },
    slug: 'width-mm',
    dataType: AttributeDataType.NUMBER,
    ...overrides,
  });

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new AttributesService(prisma as unknown as PrismaService);
  });

  describe('createAttribute', () => {
    it('создаёт атрибут NUMBER без enum-опций', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.attribute.create.mockResolvedValue({ id: 'a-1' } as any);

      await service.createAttribute(baseDto());

      expect(prisma.attribute.create).toHaveBeenCalledTimes(1);
      const arg = prisma.attribute.create.mock.calls[0][0];
      expect(arg.data.enumValues).toBe(Prisma.JsonNull); // не-enum → JsonNull
    });

    it('бросает BadRequest для ENUM без опций', async () => {
      await expect(
        service.createAttribute(baseDto({ dataType: AttributeDataType.ENUM, enumValues: [] })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attribute.create).not.toHaveBeenCalled();
    });

    it('сохраняет опции для ENUM', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.attribute.create.mockResolvedValue({ id: 'a-2' } as any);
      const enumValues = [{ value: 'red', label: { ru: 'Красный', uz: 'Qizil' } }];

      await service.createAttribute(baseDto({ dataType: AttributeDataType.ENUM, enumValues }));

      const arg = prisma.attribute.create.mock.calls[0][0];
      expect(arg.data.enumValues).toEqual(enumValues);
    });

    it('валидирует существование группы', async () => {
      prisma.attributeGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.createAttribute(baseDto({ attributeGroupId: 'missing' })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeAttribute', () => {
    it('блокирует удаление используемого атрибута', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.attribute.findUnique.mockResolvedValue({ id: 'a-1' } as any);
      prisma.productAttribute.count.mockResolvedValue(3);

      await expect(service.removeAttribute('a-1')).rejects.toThrow(ConflictException);
      expect(prisma.attribute.delete).not.toHaveBeenCalled();
    });

    it('удаляет неиспользуемый атрибут', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.attribute.findUnique.mockResolvedValue({ id: 'a-1' } as any);
      prisma.productAttribute.count.mockResolvedValue(0);

      await service.removeAttribute('a-1');

      expect(prisma.attribute.delete).toHaveBeenCalledWith({ where: { id: 'a-1' } });
    });

    it('бросает NotFound для несуществующего атрибута', async () => {
      prisma.attribute.findUnique.mockResolvedValue(null);

      await expect(service.removeAttribute('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
