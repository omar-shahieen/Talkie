export type AuthenticatedUser = {
  id: string;
  email: string;
  isTfaEnabled?: boolean;
};
