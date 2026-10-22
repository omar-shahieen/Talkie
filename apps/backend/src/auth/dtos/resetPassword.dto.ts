import { Exclude } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Match } from '../../common/decorators/match.decorator';

export class ResetPasswordDto {
  @IsString()
  @IsOptional()
  resetToken!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  @Match('newPassword')
  @Exclude({ toPlainOnly: true })
  newPasswordConfirm!: string;
}
