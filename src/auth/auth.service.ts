import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './constants';
import { SignUpDto } from './dtos/SignUpDto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
      expiresIn: '7d',
    });
    // STORE refresh token in the database
    await this.usersService.update(user.id, { currentJwtToken: refresh_token });

    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
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
    // Verify refresh token
    const decodedUser =
      await this.jwtService.verifyAsync<JwtPayload>(jwtRefreshToken);

    // check the userToken against this refresh token
    const user = await this.usersService.findById(decodedUser.sub);
    if (!user || user.currentJwtToken !== jwtRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: decodedUser.sub,
        username: decodedUser.username,
      },
      {
        expiresIn: '15m',
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
      // New user via Google — no password needed
      user = await this.usersService.create({
        email: profile.email,
        firstName: profile.name,
        googleId: profile.googleId,
        // password: null, // OAuth users have no password
      });
    } else if (!user.googleId) {
      // Existing email/password user — link their Google account
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
