import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateServerDto {
  @IsString()
  name!: string;

  @IsString()
  ownerId!: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  tags?: string[];
}
