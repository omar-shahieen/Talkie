import { Module } from '@nestjs/common';
import { ServersService } from './servers.service';
import { ServersController } from './servers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Server } from './entities/server.entity';
import { ServerMember } from './entities/server-member.entity';
import { Role } from '../roles/entities/role.entity';
import { Channel } from '../channels/entities/channel.entity';
import { Invitation } from '../invitations/entities/invitation.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([Server, ServerMember, Role, Channel, Invitation]),
  ],
  controllers: [ServersController],
  providers: [ServersService],
})
export class ServersModule {}
