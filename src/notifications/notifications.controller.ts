import { Controller, Get, Patch, Param, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { type AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificatoinService: NotificationsService) {}
  @Patch('/:id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.notificatoinService.markAsRead(notificationId, userId);
  }

  @Get()
  async getUserNotifications(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.notificatoinService.findUserNotifications(userId);
  }
}
