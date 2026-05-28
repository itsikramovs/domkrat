import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateBrandDto, UpdateBrandDto } from '../dto/create-brand.dto';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/create-category.dto';
import { BrandsService } from '../services/brands.service';
import { CategoriesService } from '../services/categories.service';

@ApiTags('Admin · Catalog')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly brands: BrandsService,
  ) {}

  // ----- Categories -----
  @Get('categories')
  @ApiOperation({ summary: 'Все категории (включая неактивные)' })
  listCategories() {
    return this.categories.listAll();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Создать категорию' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Обновить категорию' })
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить категорию (только пустую)' })
  async removeCategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categories.remove(id);
  }

  // ----- Brands -----
  @Get('brands')
  @ApiOperation({ summary: 'Все бренды (включая неактивные)' })
  listBrands() {
    return this.brands.list(true);
  }

  @Post('brands')
  @ApiOperation({ summary: 'Создать бренд' })
  createBrand(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch('brands/:id')
  @ApiOperation({ summary: 'Обновить бренд' })
  updateBrand(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить бренд' })
  async removeBrand(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.brands.remove(id);
  }
}
