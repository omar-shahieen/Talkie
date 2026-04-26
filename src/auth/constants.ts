export const jwtConstants = {
  secret: process.env.JWT_SECRET ?? 'dev-secret',
  access_expires_in: '15m' as const,
  refresh_expires_in: '7d' as const,
  tfa_expires_in: '5m' as const,
};

export type JwtPayload = { sub: string; email: string; tfa?: boolean };
