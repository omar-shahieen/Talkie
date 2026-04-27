import { SetMetadata } from '@nestjs/common';
import { AppRole } from 'src/users/entities/user.entity';

export const PERMISSION_APP_KEY = 'appPermissions';
export const RequireAppRole = (...permissions: AppRole[]) =>
  SetMetadata(PERMISSION_APP_KEY, permissions);
