import { IsNumber, IsOptional } from 'class-validator';

export class InvitationDto {
  @IsOptional()
  @IsNumber()
  maxUses?: number | null = null;

  @IsOptional()
  @IsNumber()
  expiresInHours?: number | null = null;
}
