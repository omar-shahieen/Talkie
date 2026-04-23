import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { basename, extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import sharp from 'sharp';
import { MessagesService } from './messages.service';
import { type AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateMessageDto } from './dtos/create-message.dto';
import { UpdateMessageDto } from './dtos/update-message.dto';
import { MessagePaginationDto } from './dtos/pagination.dto';
import { MessageReactionDto } from './dtos/reaction.dto';
import { SearchMessagesDto } from './dtos/search-messages.dto';
import { UploadMessageFilesDto } from './dtos/upload-message-files.dto';

const MAX_UPLOAD_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.js',
  '.mjs',
  '.cjs',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.com',
  '.scr',
  '.dll',
  '.msi',
  '.vbs',
  '.jar',
]);

const uploadsDir = join(process.cwd(), 'uploads', 'messages');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

function isAllowedMimeType(mimeType: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return true;
  }
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function hasDangerousExtension(originalName: string): boolean {
  const extension = extname(originalName).toLowerCase();
  return DANGEROUS_EXTENSIONS.has(extension);
}

function buildSafeFilename(originalName: string): string {
  const extension = extname(originalName).toLowerCase();
  const baseName = originalName
    .replace(extension, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${baseName || 'file'}-${unique}${extension}`;
}

function getBaseNameWithoutExtension(originalName: string): string {
  const extension = extname(originalName);
  return basename(originalName, extension);
}

async function compressImageFile(file: Express.Multer.File): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const compressed = await sharp(file.buffer)
    .rotate()
    .webp({ quality: 80 })
    .toBuffer();

  return {
    buffer: compressed,
    fileName: `${getBaseNameWithoutExtension(file.originalname)}.webp`,
    mimeType: 'image/webp',
  };
}

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, {
      storage: memoryStorage(),
      limits: {
        files: MAX_UPLOAD_FILES,
        fileSize: MAX_FILE_SIZE_BYTES,
      },
      fileFilter: (_req, file, cb) => {
        if (hasDangerousExtension(file.originalname)) {
          cb(
            new BadRequestException(
              `Blocked file extension: ${extname(file.originalname).toLowerCase()}`,
            ) as unknown as Error,
            false,
          );
          return;
        }

        if (!isAllowedMimeType(file.mimetype)) {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}`,
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadFiles(
    @Body() dto: UploadMessageFilesDto,
    @UploadedFiles() files: Array<any>,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ count: number; attachments: Array<Record<string, unknown>> }> {
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }

    return this.handleUpload(dto.channelId, files, req);
  }

  private async handleUpload(
    channelId: string,
    files: Express.Multer.File[],
    req: AuthenticatedRequest,
  ): Promise<{ count: number; attachments: Array<Record<string, unknown>> }> {
    await this.messagesService.assertCanUploadToChannel(channelId, req.user.id);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const attachments: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const isImage = file.mimetype.startsWith('image/');
      const processed = isImage ? await compressImageFile(file) : null;

      const sourceName = processed?.fileName ?? file.originalname;
      const storedFilename = buildSafeFilename(sourceName);
      const storedBuffer = processed?.buffer ?? file.buffer;
      const storedMimeType = processed?.mimeType ?? file.mimetype;

      await writeFile(join(uploadsDir, storedFilename), storedBuffer);

      attachments.push({
        url: `${baseUrl}/uploads/messages/${storedFilename}`,
        fileName: file.originalname,
        mimeType: storedMimeType,
        sizeBytes: storedBuffer.length,
      });
    }

    return {
      count: attachments.length,
      attachments,
    };
  }

  @Post()
  create(@Body() dto: CreateMessageDto, @Req() req: AuthenticatedRequest) {
    return this.messagesService.create(dto, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.messagesService.remove(id, req.user.id);
  }

  @Get('channel/:channelId')
  listByChannel(
    @Param('channelId') channelId: string,
    @Query() query: MessagePaginationDto,
  ) {
    return this.messagesService.listChannelMessages(channelId, query);
  }

  @Get(':id/replies')
  listReplies(@Param('id') id: string, @Query() query: MessagePaginationDto) {
    return this.messagesService.listReplies(id, query);
  }

  @Get(':id/thread')
  listThread(@Param('id') id: string, @Query() query: MessagePaginationDto) {
    return this.messagesService.listThread(id, query);
  }

  @Post(':id/reactions')
  addReaction(
    @Param('id') id: string,
    @Body() dto: MessageReactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagesService.addReaction(id, req.user.id, dto);
  }

  @Delete(':id/reactions')
  removeReaction(
    @Param('id') id: string,
    @Body() dto: MessageReactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagesService.removeReaction(id, req.user.id, dto);
  }

  @Get('search/query')
  search(@Query() query: SearchMessagesDto) {
    return this.messagesService.search(query);
  }
}
