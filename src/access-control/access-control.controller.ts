import { Controller, Get, Query } from '@nestjs/common';
import { PermissionsService } from './rbac/permissions.service';

@Controller('access-control')
export class AccessControlController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('resolve')
  resolve(
    @Query('userId') userId: string,
    @Query('serverId') serverId: string = 'server-1',
    @Query('channelId') channelId: string,
  ) {
    return this.permissionsService.resolve(userId, serverId, channelId);
  }
}
