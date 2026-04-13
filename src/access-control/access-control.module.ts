import { Module } from '@nestjs/common';
import { PermissionsService } from './rbac/permissions.service';
import { AccessControlController } from './access-control.controller';
import { PermissionGuard } from './rbac/permissions.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Server } from '../servers/entities/server.entity';
import { Role } from '../roles/entities/role.entity';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelOverwrite } from '../channels/entities/channel-overwrite.entity';
import { ServerMember } from '../users/entities/server-members.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Server,
      Role,
      Channel,
      ChannelOverwrite,
      ServerMember,
    ]),
  ],
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard],
  controllers: [AccessControlController],
})
export class AccessControlModule {}
