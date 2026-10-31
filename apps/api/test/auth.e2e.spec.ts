import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  generateRandomString,
  registerAndLogin,
  setupTestApp,
} from './test-helper';

describe('Auth Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signup', () => {
    it('should register a new user successfully', async () => {
      const rand = generateRandomString('signup');
      const email = `${rand}@example.com`;
      const username = rand.slice(0, 18);

      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          firstName: 'Alice',
          lastName: 'Smith',
          email,
          username,
          password: 'Password123!',
          passwordConfirm: 'Password123!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.results).toBeDefined();
      expect(res.body.results.email).toBe(email);
      expect(res.body.results.username).toBe(username);
      expect(res.body.results.id).toBeDefined();
    });

    it('should reject registration if email is already taken', async () => {
      const rand = generateRandomString('dupsignup');
      const email = `${rand}@example.com`;
      const username = rand.slice(0, 18);

      // First signup
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          firstName: 'Bob',
          email,
          username,
          password: 'Password123!',
          passwordConfirm: 'Password123!',
        })
        .expect(201);

      // Duplicate email
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          firstName: 'BobDuplicate',
          email,
          username: `${username}_2`,
          password: 'Password123!',
          passwordConfirm: 'Password123!',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('should reject signup when passwordConfirm does not match', async () => {
      const rand = generateRandomString('mismatch');
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          firstName: 'Charlie',
          email: `${rand}@example.com`,
          username: rand.slice(0, 18),
          password: 'Password123!',
          passwordConfirm: 'DifferentPass123!',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject signup with password shorter than 8 characters', async () => {
      const rand = generateRandomString('shortpw');
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          firstName: 'Short',
          email: `${rand}@example.com`,
          username: rand.slice(0, 18),
          password: '123',
          passwordConfirm: '123',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials and return access_token and refresh cookie', async () => {
      const rand = generateRandomString('login');
      const email = `${rand}@example.com`;
      const username = rand.slice(0, 18);
      const password = 'Password123!';

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          firstName: 'Dave',
          email,
          username,
          password,
          passwordConfirm: password,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.access_token).toBeDefined();

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('jwt_refresh='))).toBe(true);
    });

    it('should reject login with wrong password', async () => {
      const session = await registerAndLogin(app, 'wrongpw');

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: session.user.email,
          password: 'WrongPassword999!',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent_user_999@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should issue a new access token using the jwt_refresh cookie', async () => {
      const session = await registerAndLogin(app, 'refresh');

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', session.cookies)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.access_token).toBeDefined();
    });

    it('should reject refresh without cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /auth/change-password', () => {
    it('should change password and allow login with new password', async () => {
      const session = await registerAndLogin(app, 'chgpw');
      const newPassword = 'NewSecretPassword456!';

      const changeRes = await request(app.getHttpServer())
        .put('/auth/change-password')
        .set('Authorization', session.authHeader)
        .send({
          oldPassword: session.rawPassword,
          newPassword,
          newPasswordConfirm: newPassword,
        })
        .expect(200);

      expect(changeRes.body.success).toBe(true);

      // Old password should now fail
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: session.user.email,
          password: session.rawPassword,
        })
        .expect(401);

      // New password should succeed
      const newLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: session.user.email,
          password: newPassword,
        })
        .expect(200);

      expect(newLoginRes.body.results.access_token).toBeDefined();
    });

    it('should reject change-password when oldPassword is incorrect', async () => {
      const session = await registerAndLogin(app, 'badchgpw');

      const res = await request(app.getHttpServer())
        .put('/auth/change-password')
        .set('Authorization', session.authHeader)
        .send({
          oldPassword: 'IncorrectOldPassword!',
          newPassword: 'BrandNewPassword123!',
          newPasswordConfirm: 'BrandNewPassword123!',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout authenticated user and clear refresh cookie', async () => {
      const session = await registerAndLogin(app, 'logout');

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', session.authHeader)
        .set('Cookie', session.cookies)
        .expect(200);

      expect(res.body.success).toBe(true);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      // Cookie is cleared
      expect(cookies.some((c) => c.includes('jwt_refresh=;'))).toBe(true);
    });
  });

  describe('TFA flow', () => {
    it('should initiate TFA and return TOTP URI', async () => {
      const session = await registerAndLogin(app, 'tfainit');

      const res = await request(app.getHttpServer())
        .post('/auth/tfa/initiate')
        .set('Authorization', session.authHeader)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.results.uri).toBeDefined();
      expect(res.body.results.uri).toContain('otpauth://totp/');
    });

    it('should reject TFA enable with invalid code', async () => {
      const session = await registerAndLogin(app, 'tfaenable');

      // Initiate first
      await request(app.getHttpServer())
        .post('/auth/tfa/initiate')
        .set('Authorization', session.authHeader)
        .expect(201);

      // Try enabling with fake 6-digit code
      const res = await request(app.getHttpServer())
        .post('/auth/tfa/enable')
        .set('Authorization', session.authHeader)
        .send({ tfaToken: '000000' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
