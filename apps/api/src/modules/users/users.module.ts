import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AddressesService } from './addresses.service';
import { GaragesService } from './garages.service';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [MeController],
  providers: [UsersService, AddressesService, GaragesService],
  exports: [UsersService],
})
export class UsersModule {}
