import {
<<<<<<< HEAD
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
=======
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
>>>>>>> 94bb6182375aedd915386855484f9a84710886df
} from '@nestjs/common';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { JoinServerDto } from './dto/join-server.dto';
import { DiscoverServersDto } from './dto/discover-servers.dto';

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

  @Post('join')
  joinByInvite(@Body() payload: JoinServerDto) {
    return this.serversService.joinByInvite(payload);
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
}
