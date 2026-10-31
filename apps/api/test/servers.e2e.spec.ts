import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  generateRandomString,
  registerAndLogin,
  setupTestApp,
} from './test-helper';

describe('Servers Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /servers', () => {
    it('should create a new server with default general channel and owner membership', async () => {
      const session = await registerAndLogin(app, 'srvcreate');
      const serverName = `Server_${generateRandomString().slice(0, 8)}`;

      const res = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({
          name: serverName,
          description: 'A test community server',
          isPublic: true,
          tags: ['gaming', 'community'],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.results.id).toBeDefined();
      expect(res.body.results.name).toBe(serverName);
      expect(res.body.results.ownerId).toBe(session.user.id);
      expect(res.body.results.isPublic).toBe(true);
    });

    it('should reject server creation without authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/servers')
        .send({ name: 'Unauthorized Server' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /servers & GET /servers/:id', () => {
    it('should fetch server details by id', async () => {
      const session = await registerAndLogin(app, 'srvget');
      const createRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Fetchable Server', isPublic: false })
        .expect(201);

      const serverId = createRes.body.results.id;

      const res = await request(app.getHttpServer())
        .get(`/servers/${serverId}`)
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.id).toBe(serverId);
      expect(res.body.results.name).toBe('Fetchable Server');
    });

    it('should list all servers', async () => {
      const session = await registerAndLogin(app, 'srvlist');
      await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Listed Server' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/servers')
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
    });
  });

  describe('GET /servers/mine/:userId', () => {
    it('should return servers owned by or joined by the user', async () => {
      const session = await registerAndLogin(app, 'srvmine');
      const createRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'My Own Server' })
        .expect(201);

      const serverId = createRes.body.results.id;

      const res = await request(app.getHttpServer())
        .get(`/servers/mine/${session.user.id}`)
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(
        res.body.results.some(
          (s: { server?: { id: string }; id?: string }) =>
            (s.server?.id || s.id) === serverId,
        ),
      ).toBe(true);
    });
  });

  describe('GET /servers/discovery/public', () => {
    it('should discover public servers without authentication', async () => {
      const session = await registerAndLogin(app, 'srvdisc');
      const pubName = `PublicSrv_${generateRandomString().slice(0, 6)}`;

      await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({
          name: pubName,
          isPublic: true,
          description: 'Discoverable server',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/servers/discovery/public?q=${pubName}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(
        res.body.results.some((s: { name: string }) => s.name === pubName),
      ).toBe(true);
    });
  });

  describe('PATCH /servers/:id', () => {
    it('should update server name and description', async () => {
      const session = await registerAndLogin(app, 'srvupdate');
      const createRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Original Name' })
        .expect(201);

      const serverId = createRes.body.results.id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/servers/${serverId}`)
        .set('Authorization', session.authHeader)
        .send({
          name: 'Renamed Server',
          description: 'Updated server description',
        })
        .expect(200);

      expect(updateRes.body.success).toBe(true);

      const getRes = await request(app.getHttpServer())
        .get(`/servers/${serverId}`)
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(getRes.body.results.name).toBe('Renamed Server');
      expect(getRes.body.results.description).toBe(
        'Updated server description',
      );
    });
  });

  describe('DELETE /servers/:id/leave/:userId', () => {
    it('should reject leave when user is not a member', async () => {
      const owner = await registerAndLogin(app, 'srvowner');
      const nonMember = await registerAndLogin(app, 'srvnonmember');

      // Owner creates server
      const createRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', owner.authHeader)
        .send({ name: 'Leaveable Server', isPublic: true })
        .expect(201);

      const serverId = createRes.body.results.id;

      // Non-member trying to leave should fail with 404
      await request(app.getHttpServer())
        .delete(`/servers/${serverId}/leave/${nonMember.user.id}`)
        .set('Authorization', nonMember.authHeader)
        .expect(404);
    });
  });
});
