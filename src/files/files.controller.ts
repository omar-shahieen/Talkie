import {
  Controller,
  Post,
  UseInterceptors,
  Body,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { UploadMessageFilesDto } from './dtos/upload-message-files.dto';
import { type AuthenticatedRequest } from '../auth/types/authenticated-request.type';

import { BadRequestException } from 'src/common/exceptions/domain.exception';
import { MAX_UPLOAD_FILES } from 'src/friends/upload.constant';
import { uploadFileInterceptorConfig } from './files.interceptor';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, uploadFileInterceptorConfig),
  )
  async uploadFiles(
    @Body() dto: UploadMessageFilesDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ count: number; attachments: Array<Record<string, unknown>> }> {
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }

    return this.filesService.handleUpload(dto.channelId, files, req);
  }
}
