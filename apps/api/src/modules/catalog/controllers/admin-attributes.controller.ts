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
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CreateAttributeDto,
  CreateAttributeGroupDto,
  UpdateAttributeDto,
  UpdateAttributeGroupDto,
} from '../dto/create-attribute.dto';
import { AttributesService } from '../services/attributes.service';

@ApiTags('Admin · Attributes')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
@Controller('admin')
export class AdminAttributesController {
  constructor(private readonly attributes: AttributesService) {}

  // ----- Groups -----
  @Get('attribute-groups')
  @ApiOperation({ summary: 'Группы атрибутов' })
  listGroups() {
    return this.attributes.listGroups();
  }

  @Post('attribute-groups')
  @ApiOperation({ summary: 'Создать группу атрибутов' })
  createGroup(@Body() dto: CreateAttributeGroupDto) {
    return this.attributes.createGroup(dto);
  }

  @Patch('attribute-groups/:id')
  @ApiOperation({ summary: 'Обновить группу атрибутов' })
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttributeGroupDto) {
    return this.attributes.updateGroup(id, dto);
  }

  @Delete('attribute-groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить группу атрибутов' })
  async removeGroup(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.attributes.removeGroup(id);
  }

  // ----- Attributes -----
  @Get('attributes')
  @ApiOperation({ summary: 'Список атрибутов (характеристик)' })
  listAttributes(@Query('groupId') groupId?: string, @Query('categoryId') categoryId?: string) {
    return this.attributes.listAttributes({ groupId, categoryId });
  }

  @Get('attributes/:id')
  @ApiOperation({ summary: 'Детали атрибута' })
  getAttribute(@Param('id', ParseUUIDPipe) id: string) {
    return this.attributes.getAttribute(id);
  }

  @Post('attributes')
  @ApiOperation({ summary: 'Создать атрибут' })
  createAttribute(@Body() dto: CreateAttributeDto) {
    return this.attributes.createAttribute(dto);
  }

  @Patch('attributes/:id')
  @ApiOperation({ summary: 'Обновить атрибут' })
  updateAttribute(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttributeDto) {
    return this.attributes.updateAttribute(id, dto);
  }

  @Delete('attributes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить атрибут (только неиспользуемый)' })
  async removeAttribute(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.attributes.removeAttribute(id);
  }
}
