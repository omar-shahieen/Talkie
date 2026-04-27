import { SetMetadata } from '@nestjs/common';

export const PERMISSION_SERVER_KEY = 'serverPermissions';
export const RequireServerPermissions = (...permissions: bigint[]) =>
  SetMetadata(PERMISSION_SERVER_KEY, permissions);
