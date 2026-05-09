import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { Channel, ChannelType } from '../channels/entities/channel.entity';
import { ChannelMember } from '../channels/entities/channel-member.entity';
import { ServerMember } from '../servers/entities/server-member.entity';
import { LoggingService } from '../logging/logging.service';
import { type AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import {
  type FileUploadResult,
  type UploadedFileAttachment,
} from './files.types';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from 'src/common/exceptions/domain.exception';

@Injectable()
export class FilesService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'messages');

  constructor(
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly channelMembersRepository: Repository<ChannelMember>,
    @InjectRepository(ServerMember)
    private readonly serverMembersRepository: Repository<ServerMember>,
    private readonly logger: LoggingService,
  ) {
    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async handleUpload(
    channelId: string,
    files: Express.Multer.File[],
    req: AuthenticatedRequest,
  ): Promise<FileUploadResult> {
    this.logger.log('Processing upload request', {
      context: FilesService.name,
      action: 'handleUpload',
      channelId,
      userId: req.user.id,
      fileCount: files.length,
    });

    await this.assertCanUploadToChannel(channelId, req.user.id);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const attachments: UploadedFileAttachment[] = [];

    for (const file of files) {
      const processed = file.mimetype.startsWith('image/')
        ? await this.compressImageFile(file)
        : null;

      const sourceName = processed?.fileName ?? file.originalname;
      const storedFilename = this.buildSafeFilename(sourceName);
      const storedBuffer = processed?.buffer ?? file.buffer;
      const storedMimeType = processed?.mimeType ?? file.mimetype;

      await writeFile(join(this.uploadsDir, storedFilename), storedBuffer);

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

  async assertCanUploadToChannel(
    channelId: string,
    userId: string,
  ): Promise<void> {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) {
      throw new NotFoundException('channel', channelId, {
        action: 'assertCanUploadToChannel',
        channelId,
        message: 'This channel does not exist or has been deleted.',
      });
    }

    if (channel.type === ChannelType.DM) {
      const dmMember = await this.channelMembersRepository.findOneBy({
        channelId,
        userId,
      });
      if (!dmMember) {
        throw new ForbiddenException(
          'You do not have access to this direct message channel. Only participants can upload messages.',
          {
            action: 'assertCanUploadToChannel',
            channelId,
            userId,
          },
        );
      }
      return;
    }

    if (!channel.serverId) {
      this.logger.error('Server channel missing serverId', {
        context: FilesService.name,
        action: 'assertCanUploadToChannel',
        channelId,
      });
      throw new BadRequestException(
        'This channel configuration is invalid. The server ID is missing. Contact support.',
        {
          action: 'assertCanUploadToChannel',
          channelId,
        },
      );
    }

    const serverMember = await this.serverMembersRepository.findOneBy({
      serverId: channel.serverId,
      memberId: userId,
    });
    if (!serverMember) {
      throw new ForbiddenException('upload to channel', {
        action: 'assertCanUploadToChannel',
        channelId,
        userId,
        message:
          'You are not a member of the server containing this channel. Join the server first to send messages.',
      });
    }
  }

  private buildSafeFilename(originalName: string): string {
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

  private getBaseNameWithoutExtension(originalName: string): string {
    const extension = extname(originalName);
    return basename(originalName, extension);
  }

  private async compressImageFile(file: Express.Multer.File): Promise<{
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
      fileName: `${this.getBaseNameWithoutExtension(file.originalname)}.webp`,
      mimeType: 'image/webp',
    };
  }
}
