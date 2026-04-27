import { Exclude } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { Match } from '../decorators/match.decorator';
import { NotMatch } from '../decorators/NotMatch.decorator';

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @NotMatch('oldPassword')
  newPassword!: string;

  @IsString()
  @Match('password')
  @Exclude() // Excludes it when transforming to a plain object
  newPasswordConfirm!: string;
}
