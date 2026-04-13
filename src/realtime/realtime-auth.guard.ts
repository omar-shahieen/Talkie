import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { jwtConstants, JwtPayload } from '../auth/constants';

@Injectable()
export class RealtimeAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();

    if (client.data?.user) {
      return true;
    }

    const token = this.extractToken(client);
    if (!token) {
      throw new WsException({
        error: 'Unauthorized websocket connection',
        code: 'WS_UNAUTHORIZED',
      });
    }

    try {
      client.data.user = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtConstants.secret,
      });
      return true;
    } catch {
      throw new WsException({
        error: 'Unauthorized websocket connection',
        code: 'WS_UNAUTHORIZED',
      });
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token.trim()) {
      return auth.token;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string') {
      const [type, token] = header.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    const query = client.handshake.query as { token?: unknown };
    if (typeof query.token === 'string' && query.token.trim()) {
      return query.token;
    }

    return undefined;
  }
}