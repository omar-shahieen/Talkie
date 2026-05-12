import { IsOptional, IsString } from 'class-validator';

export class DiscoverServersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tags?: string;
}
