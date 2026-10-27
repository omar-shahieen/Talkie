import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { LoggingService } from '../../logging/logging.service';

import { AppPermissionsService } from './appPermissions.service';
import { AppRole } from '../../users/entities/user.entity';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request.type';
import { PERMISSION_APP_KEY } from './requireAppRole.decorator';

@Injectable()
export class AppPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly appPermissionsService: AppPermissionsService,
    private readonly logger: LoggingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<AppRole[]>(
      PERMISSION_APP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const userRole = await this.appPermissionsService.resolveUserAppRole(
      request.user.id,
    );
    return requiredPermissions.some((r) => r === userRole);
  }
}
