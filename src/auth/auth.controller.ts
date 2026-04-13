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
import { SignInDto } from './dtos/SignInDto';
import { SignUpDto } from './dtos/SignUpDto';
import { VerifyTfaDto } from './dtos/tfa.dto';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; isTfaEnabled?: boolean };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async signIn(
    @Body() _signInDto: SignInDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user.isTfaEnabled) {
      const tfaLoginToken = await this.authService.createTfaLoginToken(
        req.user,
      );

      return { tfaRequired: true, tfaLoginToken };
    }

    const { access_token, refresh_token } = await this.authService.signIn(
      req.user,
    );

    res.cookie('jwt_refresh', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { access_token };
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
  getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleLogin() {}

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response, // ← passthrough so NestJS keeps control
  ) {
    const { access_token, refresh_token } = await this.authService.signIn(
      req.user,
    );

    // Set refresh token in cookie same as local login
    res.cookie('jwt_refresh', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const oauthRedirectUrl =
      process.env.FRONTEND_OAUTH_REDIRECT_URL ?? 'http://localhost:8080/oauth';

    res.redirect(
      `${oauthRedirectUrl}?token=${encodeURIComponent(access_token)}`,
    );
  }

  /**
   * POST /auth/tfa/initiate
   * Generates a TOTP secret + QR URI. User scans it in their authenticator app.
   * Protected: user must be logged in (holds a valid access token).
   */
  @Post('tfa/initiate')
  async initiateTfa(@Req() req: AuthenticatedRequest) {
    // req.user.email is set by JwtAuthGuard
    return this.authService.initiateTfaEnabling(req.user.email);
    // Returns { uri: "otpauth://totp/..." } — pass to a QR library on the frontend
  }

  /**
   * POST /auth/tfa/enable
   * Confirms the user can produce a valid code → flips isTfaEnabled = true.
   */
  @Post('tfa/enable')
  async enableTfa(
    @Req() req: AuthenticatedRequest,
    @Body() body: VerifyTfaDto,
  ) {
    await this.authService.enableTfaForUser({
      email: req.user.email,
      tfaToken: body.tfaToken,
    });
    return { message: 'TFA enabled successfully' };
  }

  /**
   * POST /auth/tfa/disable
   * Requires a valid TOTP code to turn TFA off.
   */
  @Post('tfa/disable')
  async disableTfa(
    @Req() req: AuthenticatedRequest,
    @Body() body: VerifyTfaDto,
  ) {
    await this.authService.disableTfaForUser({
      email: req.user.email,
      tfaToken: body.tfaToken,
    });
    return { message: 'TFA disabled successfully' };
  }

  /**
   * POST /auth/tfa/verify
   * Called AFTER a successful password login when isTfaEnabled = true.
   * Exchanges a valid TOTP code for real access + refresh tokens.
   */
  @Post('tfa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyTfa(
    @Req() req: AuthenticatedRequest,
    @Body() body: Pick<VerifyTfaDto, 'tfaToken'>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authHeader = req.headers.authorization;
    const tfaLoginToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : '';

    if (!tfaLoginToken) {
      throw new UnauthorizedException('Missing TFA login token');
    }

    const user = await this.authService.validateTfaLoginToken(tfaLoginToken);
    const { access_token, refresh_token } = await this.authService.signInWithTfa(
      user,
      body.tfaToken,
    );

    res.cookie('jwt_refresh', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { access_token };
  }
}
