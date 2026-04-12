import { Module } from '@nestjs/common';
import { PermissionsService } from './rbac/permissions.service';
import { AccessControlController } from './access-control.controller';
import { PermissionGuard } from './rbac/permissions.guard';

@Module({
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard],
  controllers: [AccessControlController],
})
export class AccessControlModule {}
