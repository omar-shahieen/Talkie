import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  generateRandomString,
  registerAndLogin,
  setupTestApp,
} from './test-helper';

describe('Channels Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /channels', () => {
    it('should create a channel in a server', async () => {
      const session = await registerAndLogin(app, 'chncreate');
      const srvRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Channel Server' })
        .expect(201);

      const serverId = srvRes.body.results.id;
      const channelName = `chan-${generateRandomString().slice(0, 6)}`;

      const res = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', session.authHeader)
        .send({
          name: channelName,
          serverId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.results.id).toBeDefined();
      expect(res.body.results.name).toBe(channelName);
      expect(res.body.results.serverId).toBe(serverId);
    });

    it('should reject channel creation with missing serverId', async () => {
      const session = await registerAndLogin(app, 'chnbad');

      const res = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', session.authHeader)
        .send({ name: 'invalid-channel' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /channels & GET /channels/:id', () => {
    it('should get channel details by id', async () => {
      const session = await registerAndLogin(app, 'chnget');
      const srvRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Channel Get Server' })
        .expect(201);

      const serverId = srvRes.body.results.id;

      const createRes = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', session.authHeader)
        .send({ name: 'announcements', serverId })
        .expect(201);

      const channelId = createRes.body.results.id;

      const res = await request(app.getHttpServer())
        .get(`/channels/${channelId}`)
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.id).toBe(channelId);
      expect(res.body.results.name).toBe('announcements');
    });

    it('should list all channels', async () => {
      const session = await registerAndLogin(app, 'chnlist');

      const res = await request(app.getHttpServer())
        .get('/channels')
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.results)).toBe(true);
    });
  });

  describe('GET /channels/server/:serverId/visible/:userId', () => {
    it('should list visible channels for user in a server', async () => {
      const session = await registerAndLogin(app, 'chnvis');
      const srvRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Visible Channels Server' })
        .expect(201);

      const serverId = srvRes.body.results.id;

      const res = await request(app.getHttpServer())
        .get(`/channels/server/${serverId}/visible/${session.user.id}`)
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.results)).toBe(true);
      // 'general' is automatically created on server creation
      expect(
        res.body.results.some((c: { name: string }) => c.name === 'general'),
      ).toBe(true);
    });
  });

  describe('PATCH /channels/:id', () => {
    it('should update channel name', async () => {
      const session = await registerAndLogin(app, 'chnpatch');
      const srvRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Update Channel Server' })
        .expect(201);

      const serverId = srvRes.body.results.id;

      const createRes = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', session.authHeader)
        .send({ name: 'old-name', serverId })
        .expect(201);

      const channelId = createRes.body.results.id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/channels/${channelId}`)
        .set('Authorization', session.authHeader)
        .send({ name: 'new-name' })
        .expect(200);

      expect(updateRes.body.success).toBe(true);

      const getRes = await request(app.getHttpServer())
        .get(`/channels/${channelId}`)
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(getRes.body.results.name).toBe('new-name');
    });
  });

  describe('DELETE /channels/:id', () => {
    it('should remove a channel', async () => {
      const session = await registerAndLogin(app, 'chndel');
      const srvRes = await request(app.getHttpServer())
        .post('/servers')
        .set('Authorization', session.authHeader)
        .send({ name: 'Delete Channel Server' })
        .expect(201);

      const serverId = srvRes.body.results.id;

      const createRes = await request(app.getHttpServer())
        .post('/channels')
        .set('Authorization', session.authHeader)
        .send({ name: 'to-delete', serverId })
        .expect(201);

      const channelId = createRes.body.results.id;

      const delRes = await request(app.getHttpServer())
        .delete(`/channels/${channelId}`)
        .set('Authorization', session.authHeader)
        .expect(200);

      expect(delRes.body.success).toBe(true);

      // Verify channel is deleted
      await request(app.getHttpServer())
        .get(`/channels/${channelId}`)
        .set('Authorization', session.authHeader)
        .expect(404);
    });
  });
});
