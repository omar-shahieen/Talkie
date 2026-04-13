import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermissions } from '../access-control/rbac/require-permission.decorator';
import { Permission } from '../access-control/rbac/permissions.constants';
import { AuthJwtGuard } from '../auth/guards/auth-jwt.guard';
import { PermissionsGuard } from '../access-control/rbac/permissions.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get()
  @UseGuards(AuthJwtGuard, PermissionsGuard)
  @RequirePermissions(Permission.Administrator, Permission.SendMessages)
  getAll() {
    return this.usersService.findAll();
  }
}
