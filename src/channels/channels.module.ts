import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './entities/channel.entity';
import { ChannelOverwrite } from './entities/channel-overwrite.entity';
import { AccessControlModule } from '../access-control/access-control.module';
import { ChannelMember } from './entities/channel-member.entity';
import { ReadState } from './entities/readState.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Channel,
      ChannelOverwrite,
      ChannelMember,
      ReadState,
    ]),
    AccessControlModule,
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
