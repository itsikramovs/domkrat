import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../auth/decorators/public.decorator';
import { AttributesService } from '../services/attributes.service';
import { CategoriesService } from '../services/categories.service';

@ApiTags('Catalog · Categories')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly attributes: AttributesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Дерево активных категорий' })
  tree() {
    return this.categories.tree();
  }

  @Get(':id/attributes')
  @ApiOperation({
    summary: 'Характеристики, применимые к категории (с учётом родителей)',
  })
  attributesForCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.attributes.resolveForCategory(id);
  }

  @Get(':id/facets')
  @ApiOperation({
    summary: 'Фасеты для фильтрации: фильтруемые характеристики + значения с counts',
  })
  facetsForCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.attributes.facetsForCategory(id);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Категория по slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.categories.getBySlug(slug);
  }
}
