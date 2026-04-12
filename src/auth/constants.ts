export const jwtConstants = {
  secret: 'ENV_SECRET',
};

export type JwtPayload = { sub: number; username: string };
