import { IsString, MaxLength } from 'class-validator';

export class MessageReactionDto {
  @IsString()
  @MaxLength(64)
  emoji!: string;
}
