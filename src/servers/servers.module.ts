import { Module } from '@nestjs/common';
import { ServersService } from './servers.service';
import { ServersController } from './servers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Server } from './entities/server.entity';
import { ServerMember } from '../users/entities/server-member.entity';
import { Role } from '../roles/entities/role.entity';
import { Channel } from '../channels/entities/channel.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Server, ServerMember, Role, Channel])],
  controllers: [ServersController],
  providers: [ServersService],
})
export class ServersModule {}
