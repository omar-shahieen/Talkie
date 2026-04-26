import { Module, Global } from '@nestjs/common';
import { AccessControlController } from './access-control.controller';
import { ServerPermissionsGuard } from './server-permissions/serverPermissions.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerMember } from '../servers/entities/server-member.entity';
import { Server } from '../servers/entities/server.entity';
import { ChannelOverwrite } from '../channels/entities/channel-overwrite.entity';
import { APP_GUARD } from '@nestjs/core';
import { Channel } from '../channels/entities/channel.entity';
import { Role } from '../roles/entities/role.entity';
import { ServerPermissionsService } from './server-permissions/serverPermissions.service';
import { AppPermissionsGuard } from './app-permissions/appPermissions.guard';
import { AppPermissionsService } from './app-permissions/appPermissions.service';
import { User } from 'src/users/entities/user.entity';

@Global()
@Module({
  providers: [
    ServerPermissionsService,
    AppPermissionsService,
    {
      provide: APP_GUARD,
      useClass: ServerPermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AppPermissionsGuard,
    },
  ],
  exports: [ServerPermissionsService],
  imports: [
    TypeOrmModule.forFeature([
      ServerMember,
      Server,
      Channel,
      Role,
      ChannelOverwrite,
      User,
    ]),
  ],
  controllers: [AccessControlController],
})
export class AccessControlModule {}
