import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoggingService } from '../logging/logging.service';
import { EventBusService } from '../events/event-bus.service';
import { User } from '../users/entities/user.entity';
import { AppEvents } from '../events/events.enum';

jest.mock('otplib', () => ({
  __esModule: true,
  default: {
    generateSecret: jest.fn(() => 'mock-secret'),
    generateURI: jest.fn(() => 'mock-uri'),
    verify: jest.fn(() => true),
  },
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmailWithPassword: jest.fn<(email: string) => Promise<User | null>>(),
    findByIdWithRefreshToken: jest.fn<(id: string) => Promise<User | null>>(),
    findByEmailWithSecrets: jest.fn<(email: string) => Promise<User | null>>(),
    findByIdWithTfaSecret: jest.fn<(id: string) => Promise<User | null>>(),
    create: jest.fn<(user: Partial<User>) => Promise<User>>(),
    update:
      jest.fn<(id: string, user: Partial<User> | undefined) => Promise<User>>(),
  };

  const mockJwtService = {
    signAsync:
      jest.fn<
        (
          payload: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => Promise<string>
      >(),
    verifyAsync: jest.fn<(token: string) => Promise<Record<string, unknown>>>(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggingService = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  };

  const mockEventBusService = {
    emit: jest.fn(),
    emitAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
        {
          provide: EventBusService,
          useValue: mockEventBusService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('stores hashed refresh token on signIn', async () => {
    mockJwtService.signAsync
      .mockResolvedValueOnce('refresh_token_plain')
      .mockResolvedValueOnce('access_token_plain');

    const result = await service.signIn({
      id: 'user-id',
      email: 'user@example.com',
    });

    const updateCall = mockUsersService.update.mock.calls[0];
    const updatePayload = updateCall?.[1] as {
      currentJwtToken: string;
    };

    expect(updateCall?.[0]).toBe('user-id');
    expect(updatePayload.currentJwtToken).toEqual(expect.any(String));
    expect(updatePayload.currentJwtToken).not.toBe('refresh_token_plain');
    await expect(
      bcrypt.compare('refresh_token_plain', updatePayload.currentJwtToken),
    ).resolves.toBe(true);
    expect(mockLoggingService.log).toHaveBeenCalledWith(
      'Auth login succeeded for userId=user-id',
      AuthService.name,
    );
    expect(mockEventBusService.emit).toHaveBeenCalledWith(
      AppEvents.USER_LOGIN,
      expect.objectContaining({ userId: 'user-id' }),
    );
    expect(result).toEqual({
      access_token: 'access_token_plain',
      refresh_token: 'refresh_token_plain',
    });
  });

  it('throws UnauthorizedException when refresh token signature is invalid', async () => {
    mockJwtService.verifyAsync.mockRejectedValueOnce(
      new Error('invalid token'),
    );

    await expect(service.refreshToken('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      'Refresh token verification failed: invalid signature',
      AuthService.name,
    );
  });

  it('issues a new access token when refresh token hash matches', async () => {
    const rawRefreshToken = 'valid-refresh-token';
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);
    const user = new User();
    user.id = 'user-id';
    user.email = 'user@example.com';
    user.currentJwtToken = hashedRefreshToken;
    user.compareToken = () => Promise.resolve(true);

    mockJwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'user-id',
      username: 'user@example.com',
    });
    mockUsersService.findByIdWithRefreshToken.mockResolvedValueOnce(user);
    mockJwtService.signAsync.mockResolvedValueOnce('new-access-token');

    await expect(service.refreshToken(rawRefreshToken)).resolves.toEqual({
      access_token: 'new-access-token',
    });
    expect(mockLoggingService.log).toHaveBeenCalledWith(
      'Access token refreshed for userId=user-id',
      AuthService.name,
    );
  });

  it('logs a warning when login email does not exist', async () => {
    mockUsersService.findByEmailWithPassword.mockResolvedValueOnce(null);

    const result = await service.validateUser('missing@example.com', 'pass');

    expect(result).toBeNull();
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.stringContaining('Auth login failed: user not found'),
      AuthService.name,
    );
    expect(mockEventBusService.emit).toHaveBeenCalledWith(
      AppEvents.USER_LOGIN_FAILED,
      expect.objectContaining({ reason: 'user-not-found' }),
    );
  });

  it('logs a warning when password is invalid', async () => {
    const user = new User();
    user.id = 'user-id';
    user.email = 'user@example.com';
    user.comparePassword = () => Promise.resolve(false);

    mockUsersService.findByEmailWithPassword.mockResolvedValueOnce(user);

    const result = await service.validateUser('user@example.com', 'wrong-pass');

    expect(result).toBeNull();
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      'Auth login failed: invalid credentials userId=user-id',
      AuthService.name,
    );
    expect(mockEventBusService.emit).toHaveBeenCalledWith(
      AppEvents.USER_LOGIN_FAILED,
      expect.objectContaining({
        userId: 'user-id',
        reason: 'invalid-password',
      }),
    );
  });

  it('logs warning for invalid TFA login token', async () => {
    mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('bad token'));

    await expect(service.validateTfaLoginToken('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      'TFA login token validation failed: invalid or expired token',
      AuthService.name,
    );
  });
});
