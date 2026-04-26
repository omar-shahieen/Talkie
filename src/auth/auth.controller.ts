import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Cookies } from './decorators/cookie.decorator';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/auth-local.guard';
import { SignInDto } from './dtos/SignInDto';
import { SignUpDto } from './dtos/SignUpDto';
import { VerifyTfaDto } from './dtos/tfa.dto';
import { AuthGoogleGuard } from './guards/auth-google.guard';
import { LoggingService } from '../logging/logging.service';
import { type AuthenticatedRequest } from './types/authenticated-request.type';
import { ChangePasswordDto } from './dtos/changePassword.dto';
import { ForgetPasswordDto } from './dtos/forgetPassowrd.dto';
import { ResetPasswordDto } from './dtos/resetPassword.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: LoggingService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async signIn(
    @Body() _signInDto: SignInDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log(_signInDto);
    if (req.user.isTfaEnabled) {
      const tfaLoginToken = await this.authService.createTfaLoginToken(
        req.user.id,
        req.user.email,
      );

      return { tfaRequired: true, tfaLoginToken };
    }

    console.log(req.user);
    const { access_token, refresh_token } = await this.authService.signIn(
      req.user.id,
      req.user.email,
    );

    this.setRefreshCookie(res, refresh_token);

    return { access_token };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  createRefreshToken(@Cookies('jwt_refresh') jwt_refresh: string) {
    return this.authService.refreshToken(jwt_refresh);
  }

  @Public()
  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }
  @Public()
  @Post('test')
  test(@Body() signUpDto: SignUpDto) {
    return signUpDto;
  }

  @Put('change-password')
  changePassword(
    @Body() changePasswodDto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.changePassword(
      req.user.id,
      changePasswodDto.oldPassword,
      changePasswodDto.newPassword,
    );
  }
  @Public()
  @Post('forget-passwrod')
  forgetPassword(
    @Body() forgetPassowrdDto: ForgetPasswordDto,
    @Req() req: Request,
  ) {
    const protocol = req.protocol;
    const host = req.get('host');

    const fullUrl = `${protocol}://${host}`;
    return this.authService.forgetPassword(forgetPassowrdDto.email, fullUrl);
  }
  @Public()
  @Post('reset-passwrod')
  resetPassword(
    @Body() resetPassowrdDto: ResetPasswordDto,
    @Param('resetToken') resetToken: string,
  ) {
    return this.authService.resetPassword(
      resetPassowrdDto.newPassword,
      resetToken ?? resetPassowrdDto.resetToken,
    );
  }

  @Public()
  @UseGuards(AuthGoogleGuard)
  @Get('google')
  googleLogin() {}

  @Public()
  @UseGuards(AuthGoogleGuard)
  @Get('google/callback')
  async googleCallback(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response, // ← passthrough so NestJS keeps control
  ) {
    const oauthRedirectUrl =
      process.env.FRONTEND_OAUTH_REDIRECT_URL ?? 'http://localhost:8080/oauth';

    if (req.user.isTfaEnabled) {
      const tfaLoginToken = await this.authService.createTfaLoginToken(
        req.user.id,
        req.user.email,
      );

      res.redirect(
        `${oauthRedirectUrl}?tfaRequired=1&tfaLoginToken=${encodeURIComponent(
          tfaLoginToken,
        )}`,
      );
      return;
    }

    const { access_token, refresh_token } = await this.authService.signIn(
      req.user.id,
      req.user.email,
    );

    // Set refresh token in cookie same as local login
    this.setRefreshCookie(res, refresh_token);

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
    const tfaLoginToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : '';

    if (!tfaLoginToken) {
      throw new UnauthorizedException('Missing TFA login token');
    }

    const user = await this.authService.validateTfaLoginToken(tfaLoginToken);

    const { access_token, refresh_token } =
      await this.authService.signInWithTfa(user, body.tfaToken);

    this.setRefreshCookie(res, refresh_token);

    return { access_token };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.id);

    res.clearCookie('jwt_refresh', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return { message: 'Logged out' };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('jwt_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
