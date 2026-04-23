import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { ChatGateway } from './chat.gateway';
import { PresenceModule } from '../presence/presence.module';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Channel } from '../channels/entities/channel.entity';
import { MessageAttachment } from './entities/message-attachment.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { ChannelMember } from '../channels/entities/channel-member.entity';
import { ServerMember } from '../users/entities/server-member.entity';
import { BullModule } from '@nestjs/bullmq';
import {
  MessageRetentionConsumer,
  MessageRetentionQueueScheduler,
} from './message-retention.queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'message-retention',
    }),
    TypeOrmModule.forFeature([
      Message,
      Channel,
      ChannelMember,
      ServerMember,
      MessageAttachment,
      MessageReaction,
    ]),
    PresenceModule,
    ChannelsModule,
    UsersModule,
  ],
  controllers: [MessagesController],
  providers: [
    ChatGateway,
    MessagesService,
    MessageRetentionConsumer,
    MessageRetentionQueueScheduler,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
