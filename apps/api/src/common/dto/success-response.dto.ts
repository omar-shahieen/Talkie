import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class SuccessResponseDto {
  success: boolean = true;

  @IsString()
  message?: string;
  @IsOptional()
  @IsString()
  timestamp!: string;

  @IsOptional()
  results?: unknown;
  // Only included in development
  @IsOptional()
  @IsUUID()
  correlationId?: string;
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  ip?: string;
  @IsOptional()
  @IsInt()
  ms?: number;
}
