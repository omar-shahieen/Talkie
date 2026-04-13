import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './entities/channel.entity';
import { ChannelOverwrite } from './entities/channel-overwrite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Channel, ChannelOverwrite])],
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}
