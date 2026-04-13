import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type SignInUser = { id: string; email: string };
type SignInResult = { access_token: string; refresh_token: string };

describe('AuthController', () => {
    let controller: AuthController;

    const mockAuthService: {
        signIn: jest.Mock<(user: SignInUser) => Promise<SignInResult>>;
        refreshToken: jest.Mock;
        signUp: jest.Mock;
    } = {
        signIn: jest.fn<(user: SignInUser) => Promise<SignInResult>>(),
        refreshToken: jest.fn(),
        signUp: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    it('returns access token only and writes refresh cookie on login', async () => {
        mockAuthService.signIn.mockResolvedValueOnce({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
        });

        const req = {
            user: { id: 'u1', email: 'user@example.com' },
        } as Parameters<AuthController['signIn']>[1];

        const res = {
            cookie: jest.fn(),
        } as unknown as Response;

        const result = await controller.signIn(
            { email: 'user@example.com', password: 'password123' },
            req,
            res,
        );

        expect(res.cookie).toHaveBeenCalledWith(
            'jwt_refresh',
            'refresh-token',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'strict',
            }),
        );
        expect(result).toEqual({ access_token: 'access-token' });
    });

    it('throws UnauthorizedException when refresh cookie is missing', () => {
        expect(() =>
            controller.createRefreshToken(undefined as unknown as string),
        ).toThrow(UnauthorizedException);
    });
});
