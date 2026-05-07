import { IsUUID } from 'class-validator';

export class UploadMessageFilesDto {
  @IsUUID()
  channelId!: string;
}
