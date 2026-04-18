import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { jwtConstants, JwtPayload } from '../constants';
import { AuthenticatedSocket } from 'src/auth/types/authenticated-socket.type';
import { Socket } from 'socket.io';
import { LoggingService } from 'src/logging/logging.service';

@Injectable()
export class RealtimeAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: RealtimeAuthGuard.name });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const clientId = client.id;

    if (client.data?.user) {
      return true;
    }

    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(
        `Unauthorized WS connection: Missing token (Client ID: ${clientId})`,
      );
      this.throwUnauthorized();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtConstants.secret,
      });

      client.data.user = { id: payload.sub, email: payload.username };
      this.logger.log(
        `WS Client ${clientId} authenticated successfully for User ID: ${payload.sub || 'unknown'}`,
      );

      return true;
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Unauthorized WS connection: Invalid token (Client ID: ${clientId}) - ${errMessage}`,
      );
      this.throwUnauthorized();
    }
  }

  private throwUnauthorized(): never {
    throw new WsException({
      error: 'Unauthorized websocket connection',
      code: 'WS_UNAUTHORIZED',
    });
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
