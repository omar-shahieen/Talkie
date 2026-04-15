import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { jwtConstants, JwtPayload } from './constants';
import { SignUpDto } from './dtos/SignUpDto';
import { ConfigService } from '@nestjs/config';
import * as authenticator from 'otplib';
import { LoggingService } from '../logging/logging.service';
import { EventBusService } from '../events/event-bus.service';
import { AppEvents } from '../events/events.enum';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly eventBus: EventBusService,
  ) {}

  private redactEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!name || !domain) return 'unknown';
    const maskedName =
      name.length <= 2 ? `${name[0] ?? '*'}*` : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
  }

  // Called by LocalStrategy
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) return null;

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return null;

    return {
      id: user.id,
      email: user.email,
      isTfaEnabled: user.isTfaEnabled,
    };
  }

  async signIn(user: { id: string; email: string }) {
    const payload = { sub: user.id, username: user.email };

    const refresh_token = await this.jwtService.signAsync(payload, {
      expiresIn: jwtConstants.refresh_expires_in,
    });
    const hashedRefreshToken = await bcrypt.hash(refresh_token, 10);
    await this.usersService.update(user.id, {
      currentJwtToken: hashedRefreshToken,
    });

    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: jwtConstants.access_expires_in,
    });

    this.logger.log(
      `Auth login succeeded for userId=${user.id}`,
      AuthService.name,
    );
    this.eventBus.emit(AppEvents.USER_LOGIN, {
      userId: user.id,
      email: this.redactEmail(user.email),
      method: 'password-or-oauth',
    });

    return { access_token, refresh_token };
  }

  async createTfaLoginToken(user: { id: string; email: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.email,
      tfa: true,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: jwtConstants.tfa_expires_in,
    });
  }

  async validateTfaLoginToken(token: string) {
    let decodedUser: JwtPayload;

    try {
      decodedUser = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired TFA login token. Please sign in again.',
      );
    }

    if (!decodedUser.tfa) {
      throw new UnauthorizedException(
        'Invalid TFA login token payload. Please sign in again.',
      );
    }

    return { id: decodedUser.sub, email: decodedUser.username };
  }
  async signUp(user: SignUpDto) {
    const { firstName, lastName, email, password, username } = user;

    const createdUser = await this.usersService.create({
      firstName,
      lastName,
      email,
      password,
      username,
    });

    this.logger.log(
      `Auth signup succeeded for userId=${createdUser.id}`,
      AuthService.name,
    );
    this.eventBus.emit(AppEvents.USER_SIGNUP, {
      userId: createdUser.id,
      email: this.redactEmail(email),
      username,
    });

    return createdUser;
  }

  async refreshToken(
    jwtRefreshToken: string,
  ): Promise<{ access_token: string }> {
    let decodedUser: JwtPayload;

    try {
      decodedUser =
        await this.jwtService.verifyAsync<JwtPayload>(jwtRefreshToken);
    } catch {
      this.logger.warn(
        'Refresh token verification failed: invalid signature',
        AuthService.name,
      );
      throw new UnauthorizedException(
        'Refresh token is invalid or expired. Please sign in again.',
      );
    }

    const user = await this.usersService.findByIdWithRefreshToken(
      decodedUser.sub,
    );
    const isRefreshMatch = user?.currentJwtToken
      ? await user.compareToken(jwtRefreshToken)
      : false;

    if (!user || !isRefreshMatch) {
      this.logger.warn(
        `Refresh token rejected for userId=${decodedUser.sub}`,
        AuthService.name,
      );
      this.eventBus.emit(AppEvents.USER_LOGIN_FAILED, {
        userId: decodedUser.sub,
        reason: 'refresh-token-mismatch',
      });
      throw new UnauthorizedException(
        'Refresh token does not match active session. Please sign in again.',
      );
    }

    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: decodedUser.sub,
        username: decodedUser.username,
      },
      {
        expiresIn: jwtConstants.access_expires_in,
      },
    );

    this.logger.log(
      `Access token refreshed for userId=${decodedUser.sub}`,
      AuthService.name,
    );

    return { access_token: newAccessToken };
  }
  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    let user = await this.usersService.findByEmailWithSecrets(profile.email);

    if (!user) {
      const baseUsername = profile.email.split('@')[0] || 'user';
      const generatedUsername = `${baseUsername}_${profile.googleId.slice(0, 8)}`;

      user = await this.usersService.create({
        email: profile.email,
        firstName: profile.name,
        lastName: '',
        username: generatedUsername,
        googleId: profile.googleId,
        password: '',
      });
    } else if (!user.googleId) {
      user = await this.usersService.update(user.id, {
        googleId: profile.googleId,
      });
    }

    return user;
  }

  generateSecret(userEmail: string) {
    const appName = this.configService.get<string>('APP_NAME') ?? 'MyApp';
    const secret = authenticator.generateSecret(); // Base32 string

    const uri = authenticator.generateURI({
      label: userEmail,
      issuer: appName,
      secret,
    });

    return { uri, secret };
  }

  // Saves the secret temporarily — user must confirm with a token before it's "live"
  async initiateTfaEnabling(email: string): Promise<{ uri: string }> {
    const user = await this.usersService.findByEmailWithSecrets(email);
    if (!user) throw new NotFoundException('User was not found for TFA setup');

    const { uri, secret } = this.generateSecret(email);

    await this.usersService.update(user.id, { tfaSecret: secret });

    // Return the URI so the frontend can render the QR code
    return { uri };
  }

  //  Single consistent verify method used everywhere
  async verifyToken({
    token,
    secret,
  }: {
    token: string;
    secret: string;
  }): Promise<boolean> {
    if (!token || !secret) {
      return false;
    }

    try {
      const res = await authenticator.verify({ token, secret });
      return res.valid;
    } catch (error) {
      // If the secret is malformed (not base32), otplib may throw.
      this.logger.logError('TFA verification execution failed', error, {
        context: AuthService.name,
      });
      return false;
    }
  }

  async enableTfaForUser({
    email,
    tfaToken,
  }: {
    email: string;
    tfaToken: string;
  }): Promise<void> {
    const user = await this.usersService.findByEmailWithSecrets(email);
    if (!user) throw new NotFoundException('User was not found for TFA enable');

    if (user.isTfaEnabled) {
      throw new BadRequestException('TFA is already enabled for this account');
    }

    // Secret must have been saved via initiateTfaEnabling first
    if (!user.tfaSecret) {
      throw new ForbiddenException(
        'TFA setup has not been initiated. Call /auth/tfa/initiate first.',
      );
    }

    if (
      !(await this.verifyToken({ token: tfaToken, secret: user.tfaSecret }))
    ) {
      this.eventBus.emit(AppEvents.USER_TFA_FAILED, {
        userId: user.id,
        reason: 'enable-invalid-token',
      });
      throw new UnauthorizedException(
        'Invalid TFA code. Use a fresh code from your authenticator app.',
      );
    }

    await this.usersService.update(user.id, { isTfaEnabled: true });
    this.logger.log(`TFA enabled for userId=${user.id}`, AuthService.name);
    this.eventBus.emit(AppEvents.USER_TFA_ENABLED, {
      userId: user.id,
      email: this.redactEmail(email),
    });
  }

  async disableTfaForUser({
    email,
    tfaToken,
  }: {
    email: string;
    tfaToken: string;
  }): Promise<void> {
    const user = await this.usersService.findByEmailWithSecrets(email);
    if (!user)
      throw new NotFoundException('User was not found for TFA disable request');

    if (!user.isTfaEnabled || !user.tfaSecret) {
      throw new ForbiddenException('TFA is not enabled for this account');
    }

    if (
      !(await this.verifyToken({ token: tfaToken, secret: user.tfaSecret }))
    ) {
      this.eventBus.emit(AppEvents.USER_TFA_FAILED, {
        userId: user.id,
        reason: 'disable-invalid-token',
      });
      throw new UnauthorizedException(
        'Invalid TFA code. Use a fresh code from your authenticator app.',
      );
    }

    await this.usersService.update(user.id, {
      isTfaEnabled: false,
      tfaSecret: '',
    });
    this.logger.log(`TFA disabled for userId=${user.id}`, AuthService.name);
    this.eventBus.emit(AppEvents.USER_TFA_DISABLED, {
      userId: user.id,
      email: this.redactEmail(email),
    });
  }

  // Called during login when isTfaEnabled = true
  async signInWithTfa(user: { id: string; email: string }, tfaToken: string) {
    const fullUser = await this.usersService.findByIdWithTfaSecret(user.id);

    if (!fullUser?.tfaSecret) {
      throw new UnauthorizedException(
        'TFA is not configured for this account. Contact support if this is unexpected.',
      );
    }
    if (!fullUser?.isTfaEnabled || !fullUser.tfaSecret) {
      throw new UnauthorizedException('TFA is not enabled for this account');
    }

    if (
      !(await this.verifyToken({ token: tfaToken, secret: fullUser.tfaSecret }))
    ) {
      this.eventBus.emit(AppEvents.USER_TFA_FAILED, {
        userId: user.id,
        reason: 'signin-invalid-token',
      });
      throw new UnauthorizedException(
        'Invalid TFA code. Use a fresh code from your authenticator app.',
      );
    }

    // TFA passed — issue real tokens
    return this.signIn(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.update(userId, { currentJwtToken: '' });
    this.logger.log(`User logged out userId=${userId}`, AuthService.name);
    this.eventBus.emit(AppEvents.USER_LOGOUT, { userId });
  }
}
