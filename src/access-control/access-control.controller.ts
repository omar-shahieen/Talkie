import { Controller, Get, Query } from '@nestjs/common';
import { PermissionsService } from './rbac/permissions.service';
import { RequirePermissions } from './rbac/require-permission.decorator';
import { Permission } from './rbac/permissions.constants';
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('resolve')
  @RequirePermissions(Permission.Administrator) // Example: require Administrator permission to access this endpoint
  resolve(
    @Query('userId') userId: string,
    @Query('serverId') serverId: string,
    @Query('channelId') channelId: string,
  ) {
    return this.permissionsService.resolveForChannel(
      userId,
      serverId,
      channelId,
    );
  }
}
