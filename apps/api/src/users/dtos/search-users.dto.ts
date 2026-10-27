import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchUsersDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  q!: string;
}
