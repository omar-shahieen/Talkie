import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';
export const RequirePermissions = (...permissions: bigint[]) => {
  return SetMetadata(PERMISSION_KEY, permissions);
};
