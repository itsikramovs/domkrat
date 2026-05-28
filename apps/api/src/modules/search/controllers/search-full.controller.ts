import { BadRequestException, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MeiliService } from '../services/meili.service';

@ApiTags('Catalog · Search')
@Controller('search')
export class SearchFullController {
  constructor(private readonly meili: MeiliService) {}

  @Get('q')
  @Public()
  @ApiOperation({ summary: 'Полнотекстовый поиск (Meilisearch)' })
  async search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('categorySlug') categorySlug?: string,
  ) {
    if (!q || q.trim().length < 1) throw new BadRequestException('Query "q" is required');
    return this.meili.search(q.trim(), {
      limit: limit ? Number(limit) : 20,
      categorySlug,
    });
  }

  @Get('suggest')
  @Public()
  @ApiOperation({ summary: 'Автокомплит (топ-5 результатов для дропдауна)' })
  async suggest(@Query('q') q?: string) {
    if (!q || q.trim().length < 2) return { hits: [], estimatedTotalHits: 0 };
    return this.meili.search(q.trim(), { limit: 5 });
  }

  @Post('rebuild')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Перестроить индекс с нуля (admin)' })
  rebuild() {
    return this.meili.rebuild();
  }
}
