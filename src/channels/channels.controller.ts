import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { type AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  create(@Body() createChannelDto: CreateChannelDto) {
    return this.channelsService.create(createChannelDto);
  }

  @Get()
  findAll() {
    return this.channelsService.findAll();
  }

  @Get('server/:serverId/visible/:userId')
  findVisibleByServer(
    @Param('serverId') serverId: string,
    @Param('userId') userId: string,
  ) {
    return this.channelsService.findVisibleByServer(serverId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channelsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChannelDto: UpdateChannelDto) {
    return this.channelsService.update(id, updateChannelDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.channelsService.remove(id);
  }

  @Post('/:channelId/ack')
  ackChannel(
    @Param('channelId') channelId: string,
    @Body('messageId') messageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.channelsService.ackChannel(channelId, req.user.id, messageId);
  }
}
