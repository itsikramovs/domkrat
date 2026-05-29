import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Matches } from 'class-validator';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export const SUPPORTED_MIMES = Object.keys(MIME_TO_EXT);

export function mimeToExt(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

export class PresignProductImageDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ enum: SUPPORTED_MIMES })
  @IsString()
  @IsIn(SUPPORTED_MIMES)
  contentType!: string;

  @ApiProperty({ example: 'photo.jpg' })
  @IsString()
  @Matches(/^[\w.\-()\s]{1,200}$/)
  filename!: string;
}

export class PresignBannerImageDto {
  @ApiProperty({ enum: SUPPORTED_MIMES })
  @IsString()
  @IsIn(SUPPORTED_MIMES)
  contentType!: string;

  @ApiProperty({ example: 'banner.jpg' })
  @IsString()
  @Matches(/^[\w.\-()\s]{1,200}$/)
  filename!: string;
}
