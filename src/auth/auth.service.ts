import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { jwtConstants, JwtPayload } from './constants';
import { SignUpDto } from './dtos/SignUpDto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
  async signUp(user: SignUpDto) {
    const { firstName, lastName, email, password, username } = user;

    const newUser = await this.usersService.create({
      firstName,
      lastName,
      email,
      password,
      username,
    });

    return newUser;
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
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
