import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { CategoriesService } from '../services/categories.service';

@ApiTags('Catalog · Categories')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Дерево активных категорий' })
  tree() {
    return this.categories.tree();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Категория по slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.categories.getBySlug(slug);
  }
}
