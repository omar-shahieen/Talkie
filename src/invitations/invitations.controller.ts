import { Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { type AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { Public } from '../auth/decorators/public.decorator';
import { RequireServerPermissions } from '../access-control/server-permissions/requireServerPermission.decorator';
import { Permission } from '../access-control/server-permissions/serverPermissions.constants';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}
  @Public()
  @Get('/:inviteCode')
  async findInvitation(@Param('inviteCode') inviteCode: string) {
    return this.invitationsService.resolveInvitationCode(inviteCode);
  }

  @Delete('/:inviteCode')
  @RequireServerPermissions(Permission.Administrator)
  async removeInvitation(
    @Req() req: AuthenticatedRequest,
    @Param('inviteCode') inviteCode: string,
  ) {
    return this.invitationsService.removeInvitation(req.user.id, inviteCode);
  }
  @Post('/:inviteCode/accept')
  async acceptInvitationCode(
    @Req() req: AuthenticatedRequest,
    @Param('inviteCode') inviteCode: string,
  ) {
    return this.invitationsService.acceptInviationCode(req.user.id, inviteCode);
  }
}
