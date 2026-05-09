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
import { BullModule } from '@nestjs/bullmq';
import { MessageRetentionConsumer } from './message-retention.queue';
import { ServerMember } from 'src/servers/entities/server-member.entity';
import { LoggingModule } from 'src/logging/logging.module';
import { MessageRetentionQueueService } from './message-retention-queue.service';
import { MetricsModule } from 'src/common/metrics/metrics.module';

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
    LoggingModule,
    MetricsModule,
  ],
  controllers: [MessagesController],
  providers: [
    ChatGateway,
    MessagesService,
    MessageRetentionConsumer,
    MessageRetentionQueueService,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
