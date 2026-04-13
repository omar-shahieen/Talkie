export const jwtConstants = {
  secret: 'ENV_SECRET',
  access_expires_in: '15m',
  refresh_expires_in: '7d',
};

export type JwtPayload = { sub: string; username: string };
