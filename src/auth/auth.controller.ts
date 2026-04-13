import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // ← import this
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Cookies } from './decorators/cookie.decorator';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/auth-local.guard';
import { SignUpDto } from './dtos/SignUpDto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async signIn(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { access_token, refresh_token } = await this.authService.signIn(
      req.user, // "FIX"
    );

    res.cookie('jwt_refresh', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { access_token, refresh_token }; //  refresh token for mobile app support
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  createRefreshToken(@Cookies('jwt_refresh') jwt_refresh: string) {
    if (!jwt_refresh)
      throw new UnauthorizedException('No refresh token provided');
    return this.authService.refreshToken(jwt_refresh);
  }

  @Public()
  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Get('profile')
  getProfile(@Req() req: Request) {
    return (req as any).user; //'FIX';
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleLogin() {}

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response, // ← passthrough so NestJS keeps control
  ) {
    const { access_token, refresh_token } = await this.authService.signIn(
      (req as any).user, // "FIX"
    );

    // Set refresh token in cookie same as local login
    res.cookie('jwt_refresh', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect frontend — it reads access_token from query param and stores it
    res.redirect(`http://localhost:8080/oauth?token=${access_token}`); // "REPLACE"
  }
}
