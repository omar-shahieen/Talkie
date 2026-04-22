import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { ChatGateway } from './chat.gateway';
import { PresenceModule } from '../presence/presence.module';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    PresenceModule,
    ChannelsModule,
    UsersModule,
  ],
  providers: [ChatGateway],
})
export class MessagesModule {}
