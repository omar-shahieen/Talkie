import { IsEmail, IsString } from 'class-validator';

export class ForgetPasswordDto {
  @IsString()
  @IsEmail()
  email!: string;
}
