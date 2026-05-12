import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { MessagesService } from './messages.service';
import { type AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateMessageDto } from './dtos/create-message.dto';
import { UpdateMessageDto } from './dtos/update-message.dto';
import { MessagePaginationDto } from './dtos/pagination.dto';
import { MessageReactionDto } from './dtos/reaction.dto';
import { SearchMessagesDto } from './dtos/search-messages.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(@Body() dto: CreateMessageDto, @Req() req: AuthenticatedRequest) {
    return this.messagesService.create(dto, req.user.id);
  }

  @Public()
  @Post('guest')
  createGuest(
    @Body() dto: CreateMessageDto,
    @Headers('x-guest-user-id') guestUserId?: string,
  ) {
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!guestUserId || !uuidV4Regex.test(guestUserId)) {
      throw new BadRequestException('x-guest-user-id must be a valid UUID v4');
    }

    return this.messagesService.create(dto, guestUserId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('scope') scope: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (scope === 'everyone') {
      return this.messagesService.removeForEveryone(id, req.user.id);
    }

    return this.messagesService.remove(id, req.user.id);
  }

  @Get('channel/:channelId')
  listByChannel(
    @Param('channelId') channelId: string,
    @Query() query: MessagePaginationDto,
  ) {
    return this.messagesService.listChannelMessages(channelId, query);
  }

  @Get(':id/replies')
  listReplies(@Param('id') id: string, @Query() query: MessagePaginationDto) {
    return this.messagesService.listReplies(id, query);
  }

  @Get(':id/thread')
  listThread(@Param('id') id: string, @Query() query: MessagePaginationDto) {
    return this.messagesService.listThread(id, query);
  }

  @Post(':id/reactions')
  addReaction(
    @Param('id') id: string,
    @Body() dto: MessageReactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagesService.addReaction(id, req.user.id, dto);
  }

  @Delete(':id/reactions')
  removeReaction(
    @Param('id') id: string,
    @Body() dto: MessageReactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagesService.removeReaction(id, req.user.id, dto);
  }

  @Get('search/query')
  search(@Query() query: SearchMessagesDto) {
    return this.messagesService.search(query);
  }
}
