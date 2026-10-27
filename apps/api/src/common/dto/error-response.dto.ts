import { IsInt, IsString, IsUUID, Max, Min, IsOptional } from 'class-validator';

export class ErrorResponseDto {
  success: boolean = false;
  @IsInt()
  @Min(400)
  @Max(600)
  statusCode!: number;
  @IsString()
  errorCode!: string;
  @IsString()
  message!: string;
  @IsString()
  timestamp!: string;
  @IsString()
  path!: string;
  @IsUUID()
  @IsOptional()
  @IsUUID()
  correlationId?: string;
  @IsOptional()
  @IsInt()
  ms?: number;
  // Only included in development
  @IsOptional()
  stack?: string;
  // Only for validation errors
  @IsOptional()
  errors?: Record<string, string[]>;
}
