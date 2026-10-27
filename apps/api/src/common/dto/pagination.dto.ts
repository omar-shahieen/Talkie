import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  get skip(): number {
    const page = this.page ?? 1;
    const limit = this.limit ?? 10;
    return (page - 1) * limit;
  }

  @IsOptional()
  @IsString()
  sort?: string; // e.g. "createdAt,-name"  (prefix - = DESC)

  @IsOptional()
  @IsString()
  fields?: string; // e.g. "id,name,email"

  // everything else becomes a filter (age=25&isActive=true)
  [key: string]: any;
}
