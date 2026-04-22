import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { jwtConstants, JwtPayload } from '../constants';

interface SocketWithAuth extends Socket {
  data: {
    user?: { id: string; email: string };
  };
}

@Injectable()
export class SocketAuthMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use = (socket: Socket, next: (err?: Error) => void): void => {
    void this.authenticate(socket as SocketWithAuth, next);
  };

  private async authenticate(
    socket: SocketWithAuth,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        throw new Error('Unauthorized');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtConstants.secret,
      });

      socket.data.user = { id: payload.sub, email: payload.username };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  }

  private extractToken(socket: Socket): string | undefined {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token.trim()) {
      return auth.token;
    }

    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string') {
      const [type, token] = header.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    const query = socket.handshake.query as { token?: unknown };
    if (typeof query.token === 'string' && query.token.trim()) {
      return query.token;
    }

    return undefined;
  }
}
