import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateServerDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
