import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Exclude } from 'class-transformer';
import { Match } from '../decorators/match.decorator';

export class SignUpDto {
  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(8)
  @Exclude({ toPlainOnly: true }) // Excludes it when transforming to a plain object
  password!: string;

  @IsString()
  @Match('password')
  @Exclude()
  passwordConfirm!: string;
}
