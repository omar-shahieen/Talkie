import { IsEmail, IsNumberString, Length } from 'class-validator';

export class InitiateTfaDto {
  @IsEmail()
  email: string;
}

export class VerifyTfaDto {
  @IsNumberString()
  @Length(6, 6)
  tfaToken: string;
}
