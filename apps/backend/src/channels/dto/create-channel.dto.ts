import { IsString, IsUUID } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  name!: string;

  @IsUUID()
  serverId!: string;
}
