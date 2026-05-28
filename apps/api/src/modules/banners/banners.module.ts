import { Module } from '@nestjs/common';

import { BannersController } from './controllers/banners.controller';
import { BannersService } from './services/banners.service';

@Module({
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
