import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/** Роли, которыми можно управлять как «системными пользователями» (не клиенты/мерчанты). */
export const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.CONTENT_MANAGER,
  UserRole.SUPPORT_AGENT,
  UserRole.FINANCE_MANAGER,
  UserRole.WAREHOUSE_MANAGER,
  UserRole.WAREHOUSE_WORKER,
  UserRole.COURIER,
];

export class CreateStaffDto {
  @ApiProperty({ example: 'manager@domcrat.uz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;
}

export class SetStaffRolesDto {
  @ApiProperty({ enum: UserRole, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(UserRole, { each: true })
  roles!: UserRole[];
}
