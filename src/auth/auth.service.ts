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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import authenticator from 'otplib';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  // Called by LocalStrategy
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user; // strip password before returning
    return result;
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
      throw new UnauthorizedException('Invalid TFA login token');
    }

    if (!decodedUser.tfa) {
      throw new UnauthorizedException('Invalid TFA login token');
    }

    return { id: decodedUser.sub, email: decodedUser.username };
  }
  async signUp(user: SignUpDto) {
    const { firstName, lastName, email, password, username } = user;

    return await this.usersService.create({
      firstName,
      lastName,
      email,
      password,
      username,
    });
  }

  async refreshToken(
    jwtRefreshToken: string,
  ): Promise<{ access_token: string }> {
    let decodedUser: JwtPayload;

    try {
      decodedUser =
        await this.jwtService.verifyAsync<JwtPayload>(jwtRefreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(decodedUser.sub);
    const isRefreshMatch = user?.currentJwtToken
      ? await bcrypt.compare(jwtRefreshToken, user.currentJwtToken)
      : false;

    if (!user || !isRefreshMatch) {
      throw new UnauthorizedException('Invalid refresh token');
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

    return { access_token: newAccessToken };
  }
  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    let user = await this.usersService.findByEmail(profile.email);

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
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

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
    return authenticator.verify({ token, secret });
  }

  async enableTfaForUser({
    email,
    tfaToken,
  }: {
    email: string;
    tfaToken: string;
  }): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    if (user.isTfaEnabled) {
      throw new BadRequestException('TFA is already enabled');
    }

    // Secret must have been saved via initiateTfaEnabling first
    if (!user.tfaSecret) {
      throw new ForbiddenException('Initiate TFA setup first');
    }

    if (
      !(await this.verifyToken({ token: tfaToken, secret: user.tfaSecret }))
    ) {
      throw new UnauthorizedException('Invalid TFA token');
    }

    await this.userRepository.update({ id: user.id }, { isTfaEnabled: true });
  }

  async disableTfaForUser({
    email,
    tfaToken,
  }: {
    email: string;
    tfaToken: string;
  }): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    if (!user.isTfaEnabled || !user.tfaSecret) {
      throw new ForbiddenException('TFA is not enabled');
    }

    if (
      !(await this.verifyToken({ token: tfaToken, secret: user.tfaSecret }))
    ) {
      throw new UnauthorizedException('Invalid TFA token');
    }

    await this.userRepository.update(
      { id: user.id },
      { isTfaEnabled: false, tfaSecret: '' },
    );
  }

  // Called during login when isTfaEnabled = true
  async signInWithTfa(user: { id: string; email: string }, tfaToken: string) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser?.isTfaEnabled || !fullUser.tfaSecret) {
      throw new UnauthorizedException('TFA not configured');
    }

    if (
      !(await this.verifyToken({ token: tfaToken, secret: fullUser.tfaSecret }))
    ) {
      throw new UnauthorizedException('Invalid TFA token');
    }

    // TFA passed — issue real tokens
    return this.signIn(user);
  }
}
