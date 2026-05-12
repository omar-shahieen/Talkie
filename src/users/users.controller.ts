import { Body, Controller, Delete, Get, Patch, Query } from '@nestjs/common';
import { UsersService } from './users.service';

import { type AuthenticatedUser } from 'src/auth/types/authenticated-user.type';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateUserDto } from './dtos/updateUser.dto';
import { SearchUsersDto } from './dtos/search-users.dto';
import { Throttle } from '@nestjs/throttler';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { RequireAppRole } from 'src/access-control/app-permissions/requireAppRole.decorator';
import { AppRole } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireAppRole(AppRole.ADMIN)
  getAll(@Query() q: PaginationDto) {
    return this.usersService.findAll(q);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }
  @Patch('me')
  upadteMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, dto);
  }
  @Delete('me')
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteProfile(user.id);
  }

  // GET /users/search?q=alice
  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  searchUsers(
    @Query() query: SearchUsersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.searchByUsername(query.q, user.id);
  }
}
