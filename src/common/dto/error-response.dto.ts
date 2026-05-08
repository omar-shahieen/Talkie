import { IsInt, IsString, IsUUID, Max, Min } from 'class-validator';

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
  correlationId?: string;
  @IsInt()
  ms?: number;
  // Only included in development
  stack?: string;
  // Only for validation errors
  errors?: Record<string, string[]>;
}
