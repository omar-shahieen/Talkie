import { Module, Global } from '@nestjs/common';
import { PermissionsService } from './rbac/permissions.service';
import { AccessControlController } from './access-control.controller';
import { PermissionsGuard } from './rbac/permissions.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerMember } from '../users/entities/server-member.entity';
import { Server } from '../servers/entities/server.entity';
import { ChannelOverwrite } from '../channels/entities/channel-overwrite.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ServerMember, Server, ChannelOverwrite])],
  providers: [PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
  controllers: [AccessControlController],
})
export class AccessControlModule {}
