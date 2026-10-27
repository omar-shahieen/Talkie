import { Test, TestingModule } from '@nestjs/testing';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpCacheInterceptor } from '../src/common/interceptors/cache.interceptor';

export interface TestUserSession {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName?: string;
  };
  accessToken: string;
  authHeader: string;
  cookies: string[];
  rawPassword: string;
}

export async function setupTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideInterceptor(HttpCacheInterceptor)
    .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
    .compile();

  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();
  return app;
}

export function generateRandomString(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function registerAndLogin(
  app: INestApplication,
  prefix = 'user',
): Promise<TestUserSession> {
  const rand = generateRandomString(prefix);
  const email = `${rand}@example.com`;
  const username = rand.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18);
  const rawPassword = 'Password123!';

  // 1. Sign up
  const signupRes = await request(app.getHttpServer())
    .post('/auth/signup')
    .send({
      firstName: 'Test',
      lastName: 'User',
      email,
      username,
      password: rawPassword,
      passwordConfirm: rawPassword,
    })
    .expect(201);

  // 2. Sign in
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email,
      password: rawPassword,
    })
    .expect(200);

  const accessToken = loginRes.body.results.access_token as string;
  const cookies = (loginRes.headers['set-cookie'] as unknown as string[]) || [];

  // 3. Get /users/me
  const meRes = await request(app.getHttpServer())
    .get('/users/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  return {
    user: {
      ...meRes.body.results,
      email,
      username,
    },
    accessToken,
    authHeader: `Bearer ${accessToken}`,
    cookies,
    rawPassword,
  };
}
