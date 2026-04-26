import { Controller, Get } from '@nestjs/common';
import { RequireServerPermissions } from './server-permissions/requireServerPermission.decorator';
import { Permission } from './server-permissions/serverPermissions.constants';
import { RequireAppRole } from './app-permissions/requireAppRole.decorator';
import { AppRole } from 'src/users/entities/user.entity';
@Controller('access-control')
export class AccessControlController {
  constructor() {}

  @Get('resolveServer/:userId/:serverId')
  @RequireServerPermissions(Permission.Administrator) // Example: require Administrator permission to access this endpoint
  resolveServer() {
    return { message: 'server permissions work' };
  }
  @Get('resolveApp')
  @RequireAppRole(AppRole.ADMIN) // Example: require Administrator permission to access this endpoint
  resolve() {
    return { message: 'app permissions work' };
  }
}
