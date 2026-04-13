import { Module, Global } from '@nestjs/common';
import { PermissionsService } from './rbac/permissions.service';
import { AccessControlController } from './access-control.controller';
import { PermissionsGuard } from './rbac/permissions.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerMember } from '../users/entities/server-member.entity';
import { Server } from '../servers/entities/server.entity';
import { ChannelOverwrite } from '../channels/entities/channel-overwrite.entity';
import { Channel } from '../channels/entities/channel.entity';
import { Role } from '../roles/entities/role.entity';

@Global()
@Module({
  providers: [PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
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
