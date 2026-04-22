import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: { id: string; email: string; isTfaEnabled?: boolean };
};
