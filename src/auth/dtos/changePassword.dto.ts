import { Exclude } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { Match } from '../../common/decorators/match.decorator';
import { NotMatch } from '../../common/decorators/NotMatch.decorator';

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @NotMatch('oldPassword')
  newPassword!: string;

  @IsString()
  @Exclude() // Excludes it when transforming to a plain object
  @Match('newPassword')
  newPasswordConfirm!: string;
}
