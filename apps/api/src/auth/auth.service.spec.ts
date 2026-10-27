import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { LoggingService } from '../logging/logging.service';
import { EventBusService } from '../events/eventBus.service';
import { User } from '../users/entities/user.entity';
import { AppEvents } from '../events/events.enum';
import { UnauthorizedException } from '../common/exceptions/domain.exception';

jest.mock('otplib', () => ({
  __esModule: true,
  default: {
    generateSecret: jest.fn(() => 'mock-secret'),
    generateURI: jest.fn(() => 'mock-uri'),
    verify: jest.fn(() => Promise.resolve({ valid: true })),
  },
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn<() => Promise<User | null>>(),
  };

  const mockUsersRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    findOne: jest.fn<(opts: any) => Promise<User | null>>(),
    save: jest.fn<(user: any) => Promise<any>>((u) => Promise.resolve(u)),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
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
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
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
      .mockResolvedValueOnce('access_token_plain')
      .mockResolvedValueOnce('refresh_token_plain');

    const mockUser = new User();
    mockUser.id = 'user-id';
    mockUser.email = 'user@example.com';
    mockQueryBuilder.getOne.mockResolvedValueOnce(mockUser);

    const result = await service.signIn('user-id', 'user@example.com');

    expect(mockUsersRepository.save).toHaveBeenCalled();
    const savedUser = mockUsersRepository.save.mock.calls[0][0];
    expect(savedUser.currentJwtToken).toEqual(expect.any(String));
    expect(savedUser.currentJwtToken).not.toBe('refresh_token_plain');
    await expect(
      bcrypt.compare('refresh_token_plain', savedUser.currentJwtToken),
    ).resolves.toBe(true);
    expect(mockLoggingService.log).toHaveBeenCalledWith(
      expect.stringContaining('Auth login succeeded'),
      expect.any(Object),
    );
    expect(mockEventBusService.emit).toHaveBeenCalledWith(
      AppEvents.USER_LOGIN,
      expect.objectContaining({ userId: 'user-id' }),
    );
    expect(result).toEqual({
      message: 'Signed in successfully.',
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
      email: 'user@example.com',
    });
    mockUsersRepository.findOne.mockResolvedValueOnce(user);
    mockJwtService.signAsync.mockResolvedValueOnce('new-access-token');

    await expect(service.refreshToken(rawRefreshToken)).resolves.toEqual({
      access_token: 'new-access-token',
    });
  });

  it('throws UnauthorizedException when login email does not exist', async () => {
    mockQueryBuilder.getOne.mockResolvedValueOnce(null);

    await expect(
      service.validateUser('missing@example.com', 'pass'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when password is invalid', async () => {
    const user = new User();
    user.id = 'user-id';
    user.email = 'user@example.com';
    user.comparePassword = () => Promise.resolve(false);

    mockQueryBuilder.getOne.mockResolvedValueOnce(user);

    await expect(
      service.validateUser('user@example.com', 'wrong-pass'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for invalid TFA login token', async () => {
    mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('bad token'));

    await expect(service.validateTfaLoginToken('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
