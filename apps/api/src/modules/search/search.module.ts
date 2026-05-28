import { Module } from '@nestjs/common';

import { SearchFullController } from './controllers/search-full.controller';
import { MeiliService } from './services/meili.service';

@Module({
  controllers: [SearchFullController],
  providers: [MeiliService],
  exports: [MeiliService],
})
export class SearchModule {}
