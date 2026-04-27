import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequireServerPermissions } from '../access-control/server-permissions/requireServerPermission.decorator';
import { Permission } from '../access-control/server-permissions/serverPermissions.constants';
import { AuthJwtGuard } from '../auth/guards/auth-jwt.guard';
import { ServerPermissionsGuard } from '../access-control/server-permissions/serverPermissions.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get()
  @UseGuards(AuthJwtGuard, ServerPermissionsGuard)
  @RequireServerPermissions(Permission.Administrator, Permission.SendMessages)
  getAll() {
    return this.usersService.findAll();
  }
}
