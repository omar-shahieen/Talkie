import { Module, Global } from '@nestjs/common';
import { PermissionsService } from './rbac/permissions.service';
import { AccessControlController } from './access-control.controller';
import { PermissionsGuard } from './rbac/permissions.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerMember } from '../users/entities/server-member.entity';
import { Server } from '../servers/entities/server.entity';
import { ChannelOverwrite } from '../channels/entities/channel-overwrite.entity';
import { APP_GUARD } from '@nestjs/core';
import { Channel } from 'src/channels/entities/channel.entity';
import { Role } from 'src/roles/entities/role.entity';

@Global()
@Module({
  providers: [
    PermissionsService,
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [PermissionsService],
  imports: [
    TypeOrmModule.forFeature([
      ServerMember,
      Server,
      Channel,
      Role,
      ChannelOverwrite,
    ]),
  ],
  controllers: [AccessControlController],
})
export class AccessControlModule {}
