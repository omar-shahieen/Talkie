import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { UsersModule } from '../users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthJwtGuard } from './guards/auth-jwt.guard';
import { Module, Global } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGoogleGuard } from './guards/auth-google.guard';
import { RealtimeAuthGuard } from './guards/auth-realtime.guard';
import { SocketAuthMiddleware } from './middleware/socket-auth.middleware';
import { User } from '../users/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (!jwtSecret) {
          throw new Error('JWT_SECRET environment variable is required');
        }

        return {
          global: true,
          secret: jwtSecret,
          signOptions: { expiresIn: jwtConstants.access_expires_in },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthJwtGuard,
    },
    AuthService,
    AuthJwtGuard,
    AuthGoogleGuard,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    RealtimeAuthGuard,
    SocketAuthMiddleware,
  ],
  exports: [
    AuthJwtGuard,
    AuthService,
    RealtimeAuthGuard,
    SocketAuthMiddleware,
    JwtModule,
  ],
})
export class AuthModule {}
