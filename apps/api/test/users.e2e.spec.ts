import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  generateRandomString,
  registerAndLogin,
  setupTestApp,
} from './test-helper';

describe('Users Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/me', () => {
    it('should return profile for authenticated user', async () => {
      const session = await registerAndLogin(app, 'usersme');

      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.id).toBe(session.user.id);
      expect(res.body.results.email).toBe(session.user.email);
      expect(res.body.results.username).toBe(session.user.username);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /users/me', () => {
    it('should update profile successfully', async () => {
      const session = await registerAndLogin(app, 'userupdate');
      const updatedFirst = 'UpdatedFirst';
      const updatedLast = 'UpdatedLast';

      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', session.authHeader)
        .send({
          firstName: updatedFirst,
          lastName: updatedLast,
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify update persisted
      const getRes = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(getRes.body.results.firstName).toBe(updatedFirst);
      expect(getRes.body.results.lastName).toBe(updatedLast);
    });

    it('should reject update if invalid properties are provided', async () => {
      const session = await registerAndLogin(app, 'badupdate');

      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', session.authHeader)
        .send({
          unknownField: 'invalidValue',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /users/search', () => {
    it('should find users matching query', async () => {
      const uniqueTag = generateRandomString('srch')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 8);
      const sessionA = await registerAndLogin(app, uniqueTag);
      const sessionB = await registerAndLogin(app, 'otheruser');

      const res = await request(app.getHttpServer())
        .get(`/users/search?q=${uniqueTag}`)
        .set('Authorization', sessionB.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(
        res.body.results.some((u: { id: string }) => u.id === sessionA.user.id),
      ).toBe(true);
    });
  });
});
