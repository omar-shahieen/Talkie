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

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '60s' }, //default
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
    LocalStrategy,
    JwtStrategy,
    // GoogleStrategy,
  ],
  exports: [AuthJwtGuard, AuthService],
})
export class AuthModule {}
