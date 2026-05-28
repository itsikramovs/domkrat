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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateGarageDto, UpdateGarageDto } from './dto/garage.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GaragesService } from './garages.service';
import { UsersService } from './users.service';

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly addresses: AddressesService,
    private readonly garages: GaragesService,
  ) {}

  // ----- Profile -----
  @Get()
  @ApiOperation({ summary: 'Текущий профиль' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getProfile(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Обновить профиль' })
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Сменить пароль (отзывает все сессии)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.users.changePassword(user.id, dto);
  }

  // ----- Addresses -----
  @Get('addresses')
  @ApiOperation({ summary: 'Список адресов' })
  listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.list(user.id);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Создать адрес' })
  createAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Get('addresses/:id')
  @ApiOperation({ summary: 'Получить адрес' })
  getAddress(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.addresses.get(user.id, id);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Обновить адрес' })
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить адрес (soft)' })
  async removeAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.addresses.remove(user.id, id);
  }

  @Post('addresses/:id/set-default')
  @ApiOperation({ summary: 'Сделать адрес основным' })
  setDefaultAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addresses.setDefault(user.id, id);
  }

  // ----- Garage -----
  @Get('garages')
  @ApiOperation({ summary: 'Сохранённые авто' })
  listGarages(@CurrentUser() user: AuthenticatedUser) {
    return this.garages.list(user.id);
  }

  @Post('garages')
  @ApiOperation({ summary: 'Добавить авто' })
  createGarage(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGarageDto) {
    return this.garages.create(user.id, dto);
  }

  @Patch('garages/:id')
  @ApiOperation({ summary: 'Обновить авто (пробег и т.д.)' })
  updateGarage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGarageDto,
  ) {
    return this.garages.update(user.id, id, dto);
  }

  @Delete('garages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить авто' })
  async removeGarage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.garages.remove(user.id, id);
  }
}
