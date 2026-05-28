import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(8, 100)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @Length(8, 100)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  newPassword!: string;
}
