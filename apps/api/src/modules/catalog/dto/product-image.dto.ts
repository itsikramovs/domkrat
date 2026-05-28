import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class RegisterProductImageDto {
  @ApiProperty({ description: 'Публичный URL объекта в MinIO (вернулся из presign)' })
  @IsString()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional({ description: 'URL миниатюры (опционально)' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
