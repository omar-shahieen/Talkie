import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { DiscoverServersDto } from './dto/discover-servers.dto';
import { CreateInvitationDto } from './dto/create-invititaion.dto';
import { type AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { Permission } from '../access-control/server-permissions/serverPermissions.constants';
import { RequireServerPermissions } from 'src/access-control/server-permissions/requireServerPermission.decorator';

@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  create(@Body() createServerDto: CreateServerDto) {
    return this.serversService.create(createServerDto);
  }

  @Get()
  findAll() {
    return this.serversService.findAll();
  }

  @Get('mine/:userId')
  findForUser(@Param('userId') userId: string) {
    return this.serversService.findForUser(userId);
  }

  @Get('discovery/public')
  discover(@Query() query: DiscoverServersDto) {
    return this.serversService.discover(query);
  }

  @Delete(':id/leave/:userId')
  leave(@Param('id') id: string, @Param('userId') userId: string) {
    return this.serversService.leaveServer(id, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serversService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateServerDto: UpdateServerDto) {
    return this.serversService.update(id, updateServerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('requesterId') requesterId: string) {
    return this.serversService.remove(id, requesterId);
  }

  @Post('/:serverId/invitation')
  @RequireServerPermissions(Permission.Administrator)
  async craeteInvitation(
    @Body() payload: CreateInvitationDto,
    @Req() req: AuthenticatedRequest,
    @Param('serverId') serverId: string,
  ) {
    return this.serversService.createInviation(req.user.id, serverId, payload);
  }

  @Get('/:serverId/invitation')
  @RequireServerPermissions(Permission.Administrator)
  async findUserInvitations(
    @Req() req: AuthenticatedRequest,
    @Param('serverId') serverId: string,
  ) {
    return this.serversService.findUserInvitations(req.user.id, serverId);
  }
}
