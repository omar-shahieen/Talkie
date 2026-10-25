import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerMember } from '../servers/entities/server-member.entity';
import { ChannelMember } from '../channels/entities/channel-member.entity';
import { Channel } from '../channels/entities/channel.entity';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServerMember, ChannelMember, Channel])],
  controllers: [FilesController],
  providers: [FilesService, StorageService],
})
export class FilesModule {}
