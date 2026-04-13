export const jwtConstants = {
  access_expires_in: '15m' as const,
  refresh_expires_in: '7d' as const,
};

export type JwtPayload = { sub: string; username: string };
