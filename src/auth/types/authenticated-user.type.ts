import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  email: string;
  isTfaEnabled?: boolean;
};
