import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  it('stores hashed refresh token on signIn', async () => {
    jwtService.signAsync
      .mockResolvedValueOnce('refresh_token_plain')
      .mockResolvedValueOnce('access_token_plain');

    const result = await service.signIn({
      id: 'user-id',
      email: 'user@example.com',
    });

    const updatePayload = usersService.update.mock.calls[0]?.[1] as {
      currentJwtToken: string;
    };

    expect(usersService.update).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({ currentJwtToken: expect.any(String) }),
    );
    expect(updatePayload.currentJwtToken).not.toBe('refresh_token_plain');
    await expect(
      bcrypt.compare('refresh_token_plain', updatePayload.currentJwtToken),
    ).resolves.toBe(true);
    expect(result).toEqual({
      access_token: 'access_token_plain',
      refresh_token: 'refresh_token_plain',
    });
  });

  it('throws UnauthorizedException when refresh token signature is invalid', async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid token'));

    await expect(service.refreshToken('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('issues a new access token when refresh token hash matches', async () => {
    const rawRefreshToken = 'valid-refresh-token';
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'user-id',
      username: 'user@example.com',
    });
    usersService.findById.mockResolvedValueOnce({
      id: 'user-id',
      currentJwtToken: hashedRefreshToken,
    } as any);
    jwtService.signAsync.mockResolvedValueOnce('new-access-token');

    await expect(service.refreshToken(rawRefreshToken)).resolves.toEqual({
      access_token: 'new-access-token',
    });
  });
});
