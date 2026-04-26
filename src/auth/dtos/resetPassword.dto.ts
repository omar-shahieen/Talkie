import { Exclude } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Match } from '../decorators/match.decorator';

export class ResetPasswordDto {
  @IsString()
  @IsOptional()
  resetToken!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  @Match('password')
  @Exclude() // Excludes it when transforming to a plain object
  newPasswordConfirm!: string;
}
