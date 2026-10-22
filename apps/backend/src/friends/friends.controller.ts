// friends.controller.ts
import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-request.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller()
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('friendRequests')
  sendRequest(
    @CurrentUser('id') senderId: string,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendsService.sendRequest(senderId, dto.receiverId);
  }

  @Patch('friendRequests/:id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  acceptRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.friendsService.acceptRequest(id, user.id);
  }

  @Patch('friendRequests/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.friendsService.rejectRequest(id, user.id);
  }

  @Delete('friendRequests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.friendsService.cancelRequest(id, user.id);
  }

  @Get('friendRequests/incoming')
  getIncoming(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.getIncomingRequests(user.id);
  }

  @Get('friendRequests/outgoing')
  getOutgoing(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.getOutgoingRequests(user.id);
  }

  @Get('friends')
  getFriends(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.getFriends(user.id);
  }
  @Delete('friends/:targetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfriend(
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.friendsService.unfriend(user.id, targetId);
  }
}
