import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateCategoryDto, UpdateCategoryDto } from '../dto/create-category.dto';

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Возвращает дерево активных категорий (для public каталога). */
  async tree(): Promise<CategoryTreeNode[]> {
    const all = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const byId = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];
    for (const c of all) byId.set(c.id, { ...c, children: [] });
    for (const c of all) {
      const node = byId.get(c.id)!;
      if (c.parentId) {
        const parent = byId.get(c.parentId);
        if (parent) parent.children.push(node);
        else roots.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /** Flat list (включая неактивные — для админки). */
  listAll() {
    return this.prisma.category.findMany({
      orderBy: [{ level: 'asc' }, { position: 'asc' }],
    });
  }

  async getBySlug(slug: string) {
    const cat = await this.prisma.category.findUnique({ where: { slug } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const level = dto.parentId ? await this.calcLevel(dto.parentId) : 0;
    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name as unknown as Prisma.InputJsonValue,
          slug: dto.slug,
          description: dto.description as unknown as Prisma.InputJsonValue,
          parentId: dto.parentId,
          iconUrl: dto.iconUrl,
          imageUrl: dto.imageUrl,
          position: dto.position ?? 0,
          isActive: dto.isActive ?? true,
          level,
        },
      });
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');

    let level = existing.level;
    if (dto.parentId !== undefined) {
      level = dto.parentId ? await this.calcLevel(dto.parentId) : 0;
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name as unknown as Prisma.InputJsonValue,
          slug: dto.slug,
          description: dto.description as unknown as Prisma.InputJsonValue,
          parentId: dto.parentId,
          iconUrl: dto.iconUrl,
          imageUrl: dto.imageUrl,
          position: dto.position,
          isActive: dto.isActive,
          level,
        },
      });
    } catch (error) {
      this.handleUniqueErr(error);
    }
  }

  async remove(id: string): Promise<void> {
    const childrenCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      throw new ConflictException('Cannot delete category with children');
    }
    const productsCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      throw new ConflictException('Cannot delete category with products');
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async calcLevel(parentId: string): Promise<number> {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { level: true },
    });
    if (!parent) throw new NotFoundException('Parent category not found');
    return parent.level + 1;
  }

  private handleUniqueErr(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`Category with the same unique field already exists`);
    }
    throw error as Error;
  }
}
