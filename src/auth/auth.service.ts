import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { jwtConstants, JwtPayload } from './constants';
import { SignUpDto } from './dtos/SignUpDto';
import { ConfigService } from '@nestjs/config';
import * as authenticator from 'otplib';
import { LoggingService } from '../logging/logging.service';
import { EventBusService } from '../events/eventBus.service';
import { AppEvents } from '../events/events.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { nanoid } from 'nanoid';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from 'src/common/exceptions/domain.exception';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cache: Cache,

    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly eventBus: EventBusService,
  ) {}

  private redactEmail(email: string): string {
    // masking emails to prevent email leakage
    const [name, domain] = email.split('@');
    if (!name || !domain) return 'unknown';
    const maskedName =
      name.length <= 2 ? `${name[0] ?? '*'}*` : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
  }

  // called by local strategy
  async validateUser(email: string, password: string) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      await sleep(300); // Delays for 300 ms for security reasone
      throw new UnauthorizedException(
        'Email or password is incorrect. Please check your credentials and try again.',
        {
          action: 'validateUser',
          // deliberately vague to client — detailed reason only in logs/audit
          emailRedacted: this.redactEmail(email),
          reason: 'user-not-found',
        },
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedException(
        'Email or password is incorrect. Please check your credentials and try again.',
        {
          action: 'validateUser',
          userId: user.id,
          emailRedacted: this.redactEmail(user.email),
          reason: 'invalid-password',
        },
      );
    }

    return {
      id: user.id,
      email: user.email,
      isTfaEnabled: user.isTfaEnabled,
    };
  }
  async signIn(userId: string, email: string) {
    const payload = { sub: userId, email };

    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.currentJwtToken')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('user', userId, {
        action: 'signIn',
        userId,
        message: 'User account not found. The account may have been deleted.',
      });
    }
    // create access and refresh token
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: jwtConstants.access_expires_in,
    });

    const refresh_token = await this.jwtService.signAsync(payload, {
      expiresIn: jwtConstants.refresh_expires_in,
    });
    // hash and save refresh token to db
    const hashedRefreshToken = await bcrypt.hash(refresh_token, 10);

    user.currentJwtToken = hashedRefreshToken;

    await this.usersRepository.save(user);

    this.logger.log(
      `Auth login succeeded for email=${this.redactEmail(email)}`,
      {
        context: AuthService.name,
        action: 'signIn',
        userId,
        emailRedacted: this.redactEmail(email),
      },
    );
    this.eventBus.emit(AppEvents.USER_LOGIN, {
      userId: userId,
      email: email,
      method: 'password-or-oauth',
    });

    return {
      message: 'Signed in successfully.',
      access_token,
      refresh_token,
    };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'password'], // explicitly select password since select: false
    });
    if (!user) {
      throw new NotFoundException('user', userId, {
        action: 'changePassword',
        userId,
      });
    }

    // check old password

    const isCorrectPassword = await user.comparePassword(oldPassword);
    if (!isCorrectPassword) {
      throw new UnauthorizedException(
        'The current password you provided is incorrect. Please verify and try again.',
        {
          action: 'changePassword',
          userId,
        },
      );
    }

    // store the new password
    user.password = newPassword;
    await this.usersRepository.save(user); // save the new password hashed

    return { message: 'Password updated successfully.' };
  }
  async forgetPassword(email: string, fullurl: string) {
    const user = await this.usersRepository.findOneBy({ email });

    if (user) {
      // invalidate any existing token for this user
      const existingToken = await this.cache.get<string>(
        `resetTokenByUser:${user.id}`,
      );
      if (existingToken) {
        await this.cache.del(`resetToken:${existingToken}`);
      }

      const token = nanoid(64);
      const TTL = 10 * 60 * 1000;

      // store both directions
      await this.cache.set(`resetToken:${token}`, user.id, TTL); // token → userId
      await this.cache.set(`resetTokenByUser:${user.id}`, token, TTL); // userId → token

      const reseturlLink = `${fullurl}/reset-password/?token=${token}`;

      this.eventBus.emit(AppEvents.USER_FORGETPASSWORD, {
        email: user.email,
        username: user.username,
        reseturlLink,
      });
    }

    return {
      message: 'If the account exists, a password reset email has been sent.',
    };
  }

  async resetPassword(newPassword: string, resetToken: string) {
    const userId = await this.cache.get<string>(`resetToken:${resetToken}`);
    if (!userId) {
      throw new UnauthorizedException(
        'The password reset token is invalid or has expired. Please request a new password reset.',
        {
          action: 'resetPassword',
        },
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });
    if (!user) {
      throw new NotFoundException('user', userId, {
        action: 'resetPassword',
        userId,
        message: 'User account not found. The account may have been deleted.',
      });
    }

    user.password = newPassword;
    await this.usersRepository.save(user);

    // clean up both keys
    await this.cache.del(`resetToken:${resetToken}`);
    await this.cache.del(`resetTokenByUser:${userId}`);
  }
  async createTfaLoginToken(userId: string, email: string) {
    const payload: JwtPayload = {
      sub: userId,
      email,
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
        'Your TFA login token has expired or is invalid. Please sign in again and complete two-factor authentication.',
        {
          action: 'validateTfaLoginToken',
        },
      );
    }

    if (!decodedUser.tfa) {
      throw new UnauthorizedException(
        'The TFA login token is malformed or invalid. Please sign in again and complete two-factor authentication.',
        {
          action: 'validateTfaLoginToken',
          userId: decodedUser.sub,
        },
      );
    }

    return { id: decodedUser.sub, email: decodedUser.email };
  }
  async signUp(user: SignUpDto) {
    const { firstName, lastName, email, password, username } = user;

    const createdUser = this.usersRepository.create({
      firstName,
      lastName,
      email,
      password,
      username,
    });

    await this.usersRepository.save(createdUser);

    this.logger.log(`Auth signup succeeded for userId=${createdUser.id}`, {
      context: AuthService.name,
      action: 'signUp',
      userId: createdUser.id,
      email: this.redactEmail(email),
    });

    this.eventBus.emit(AppEvents.USER_SIGNUP, {
      userId: createdUser.id,
      email,
      emailRedacted: this.redactEmail(email),
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
      throw new UnauthorizedException(
        'Refresh token is invalid or expired. Please sign in again.',
        {
          action: 'refreshToken',
        },
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: decodedUser.sub },
      select: ['id', 'currentJwtToken'],
    });

    const isRefreshMatch = user?.currentJwtToken
      ? await user.compareToken(jwtRefreshToken)
      : false;

    if (!user || !isRefreshMatch) {
      this.eventBus.emit(AppEvents.USER_LOGIN_FAILED, {
        userId: decodedUser.sub,
        reason: 'refresh-token-mismatch',
      });
      throw new UnauthorizedException(
        'Refresh token does not match active session. Please sign in again.',
        {
          action: 'refreshToken',
          userId: decodedUser.sub,
        },
      );
    }

    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: decodedUser.sub,
        email: decodedUser.email,
      },
      {
        expiresIn: jwtConstants.access_expires_in,
      },
    );

    this.logger.log(`Access token refreshed for userId=${decodedUser.sub}`, {
      context: AuthService.name,
      action: 'refreshToken',
      userId: decodedUser.sub,
    });

    return { access_token: newAccessToken };
  }

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    const redactedEmail = this.redactEmail(profile.email);

    let user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.googleId')
      .where('user.email = :email', { email: profile.email })
      .getOne();

    if (!user) {
      const baseUsername = profile.email.split('@')[0] || 'user';
      const generatedUsername = `${baseUsername}_${profile.googleId.slice(0, 8)}`;

      user = this.usersRepository.create({
        email: profile.email,
        firstName: profile.name,
        lastName: '',
        username: generatedUsername,
        googleId: profile.googleId,
        password: '',
      });

      await this.usersRepository.save(user);

      this.logger.log(
        `Google OAuth user created userId=${user.id} email=${redactedEmail}`,
        {
          context: AuthService.name,
          action: 'findOrCreateGoogleUser',
          userId: user.id,
          email: redactedEmail,
        },
      );
    } else if (!user.googleId) {
      user.googleId = profile.googleId;

      await this.usersRepository.save(user);

      this.logger.log(
        `Google OAuth account linked userId=${user.id} email=${redactedEmail}`,
        {
          context: AuthService.name,
          action: 'findOrCreateGoogleUser',
          userId: user.id,
          email: redactedEmail,
        },
      );
    } else {
      this.logger.debug(
        `Google OAuth login matched existing linked userId=${user.id} email=${redactedEmail}`,
        {
          context: AuthService.name,
          action: 'findOrCreateGoogleUser',
          userId: user.id,
          email: redactedEmail,
        },
      );
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
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.tfaSecret')
      .where('user.email = :email', { email })
      .getOne();
    if (!user) {
      throw new NotFoundException('user', email, {
        action: 'initiateTfaEnabling',
        email,
      });
    }

    const { uri, secret } = this.generateSecret(email);

    user.tfaSecret = secret;

    await this.usersRepository.save(user);

    this.logger.log(
      `TFA setup initiated for userId=${user.id} email=${this.redactEmail(email)}`,
      {
        context: AuthService.name,
        action: 'initiateTfaEnabling',
        userId: user.id,
        email: this.redactEmail(email),
      },
    );

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
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.tfaSecret')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new NotFoundException('user', email, {
        action: 'enableTfaForUser',
        email,
        message: 'User account not found. Please check your email address.',
      });
    }

    if (user.isTfaEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled for your account. Disable it first if you want to set up a new one.',
        {
          action: 'enableTfaForUser',
          userId: user.id,
        },
      );
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

    user.isTfaEnabled = true;

    await this.usersRepository.save(user);

    this.logger.log(`TFA enabled for userId=${user.id}`, {
      context: AuthService.name,
      action: 'enableTfaForUser',
      userId: user.id,
      email: this.redactEmail(email),
    });
    this.eventBus.emit(AppEvents.USER_TFA_ENABLED, {
      userId: user.id,
      email,
      emailRedacted: this.redactEmail(email),
    });
  }

  async disableTfaForUser({
    email,
    tfaToken,
  }: {
    email: string;
    tfaToken: string;
  }): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.tfaSecret')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new NotFoundException('user', email, {
        action: 'disableTfaForUser',
        email,
        message: 'User account not found. Please check your email address.',
      });
    }

    if (!user.isTfaEnabled || !user.tfaSecret) {
      throw new ForbiddenException(
        'Two-factor authentication is not enabled for this account. Enable it first before you can use TFA authentication.',
        {
          action: 'disableTfaForUser',
          userId: user.id,
        },
      );
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

    user.isTfaEnabled = false;
    user.tfaSecret = '';

    await this.usersRepository.save(user);

    this.logger.log(`TFA disabled for userId=${user.id}`, {
      context: AuthService.name,
      action: 'disableTfaForUser',
      userId: user.id,
      email: this.redactEmail(email),
    });

    this.eventBus.emit(AppEvents.USER_TFA_DISABLED, {
      userId: user.id,
      email,
      emailRedacted: this.redactEmail(email),
    });
  }

  // Called during login when isTfaEnabled = true
  async signInWithTfa(user: { id: string; email: string }, tfaToken: string) {
    const fullUser = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.tfaSecret')
      .where('user.id = :id', { id: user.id })
      .getOne();

    if (!fullUser?.tfaSecret) {
      throw new UnauthorizedException(
        'TFA is not configured for this account. Contact support if this is unexpected.',
        {
          action: 'signInWithTfa',
          userId: user.id,
        },
      );
    }
    if (!fullUser?.isTfaEnabled || !fullUser.tfaSecret) {
      throw new UnauthorizedException(
        'Two-factor authentication is not enabled for this account. Please enable it first.',
        {
          action: 'signInWithTfa',
          userId: user.id,
        },
      );
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
    return this.signIn(fullUser.id, fullUser.username);
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { currentJwtToken: '' });
    this.logger.log(`User logged out userId=${userId}`, {
      context: AuthService.name,
      action: 'logout',
      userId,
    });
    this.eventBus.emit(AppEvents.USER_LOGOUT, { userId });
  }
}
