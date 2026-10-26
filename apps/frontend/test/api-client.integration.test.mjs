import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMockApiServer } from './mock-api-server.mjs';
import { ensureEnvironment, resetLocalStorage } from './setup.mjs';

let server;
let apiClient;
let authStorage;

before(async () => {
  server = createMockApiServer();
  const { baseUrl } = await server.start();
  ensureEnvironment(baseUrl);

  // Import frontend modules dynamically after env setup
  apiClient = await import('../src/app/services/api.service.ts');
  authStorage = await import('../src/app/authStorage.ts');
});

after(async () => {
  if (server) {
    await server.stop();
  }
});

beforeEach(() => {
  resetLocalStorage();
  server.clearRequests();
  server.clearHandlers();
});

test('buildApiUrl serializes path and query params according to API spec', () => {
  const url1 = apiClient.buildApiUrl('/users');
  assert.equal(url1, `${server.baseUrl}/users`);

  const url2 = apiClient.buildApiUrl('servers', {
    q: 'gaming',
    limit: 20,
    isPublic: true,
    empty: null,
    skipped: undefined,
  });
  const parsed = new URL(url2);
  assert.equal(parsed.pathname, '/servers');
  assert.equal(parsed.searchParams.get('q'), 'gaming');
  assert.equal(parsed.searchParams.get('limit'), '20');
  assert.equal(parsed.searchParams.get('isPublic'), 'true');
  assert.equal(parsed.searchParams.has('empty'), false);
  assert.equal(parsed.searchParams.has('skipped'), false);
});

test('normalizeBlobUrl transforms legacy /image/blob endpoints to /file/blob', () => {
  assert.equal(
    apiClient.normalizeBlobUrl('http://127.0.0.1:3000/image/blob/avatar.png'),
    'http://127.0.0.1:3000/file/blob/avatar.png',
  );
  assert.equal(apiClient.normalizeBlobUrl(null), '');
  assert.equal(apiClient.normalizeBlobUrl(undefined), '');
});

test('unwrapApiPayload unpacks NestJS TransformInterceptor envelopes', () => {
  // Standard results object envelope
  const enveloped = {
    success: true,
    message: 'Found',
    results: { id: 'srv_123', name: 'Talkie HQ' },
  };
  assert.deepEqual(apiClient.unwrapApiPayload(enveloped), { id: 'srv_123', name: 'Talkie HQ' });

  // Numeric character record normalization (joined to string)
  const charRecord = {
    success: true,
    results: { 0: 'p', 1: 'i', 2: 'n', 3: 'g' },
  };
  assert.equal(apiClient.unwrapApiPayload(charRecord), 'ping');

  // Numeric object record normalization (converted to ordered array)
  const objectRecord = {
    success: true,
    results: { 0: { id: 1 }, 1: { id: 2 } },
  };
  assert.deepEqual(apiClient.unwrapApiPayload(objectRecord), [{ id: 1 }, { id: 2 }]);

  // Empty object results with message returns { message }
  const emptyObjWithMessage = {
    success: true,
    message: 'Operation deleted',
    results: {},
  };
  assert.deepEqual(apiClient.unwrapApiPayload(emptyObjWithMessage), { message: 'Operation deleted' });

  // Non-enveloped payload returned as-is
  const raw = { rawField: 'value' };
  assert.deepEqual(apiClient.unwrapApiPayload(raw), { rawField: 'value' });
});

test('requestJson automatically attaches Authorization: Bearer <token> from authStorage', async () => {
  authStorage.setAccessToken('active-user-jwt-token');

  await apiClient.requestJson('/users/me');

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.path, '/users/me');
  assert.equal(req.headers.authorization, 'Bearer active-user-jwt-token');
});

test('requestJson supports explicit token override in options', async () => {
  authStorage.setAccessToken('stored-token');

  await apiClient.requestJson('/users/me', {
    token: 'override-token-value',
  });

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.headers.authorization, 'Bearer override-token-value');
});

test('requestJson parses NestJS validation errors and throws ApiError', async () => {
  server.setHandler('POST /test/validation', (req, res, { formatError }) => {
    res.statusCode = 400;
    res.end(
      JSON.stringify(
        formatError(400, 'Validation failed', {
          email: ['email must be an email'],
          username: ['username is too short'],
        }),
      ),
    );
  });

  await assert.rejects(
    async () => {
      await apiClient.requestJson('/test/validation', { method: 'POST', body: {} });
    },
    (err) => {
      assert(err instanceof apiClient.ApiError);
      assert.equal(err.status, 400);
      assert.match(err.message, /email: email must be an email/);
      assert.match(err.message, /username: username is too short/);
      return true;
    },
  );
});

test('requestJson automatically refreshes expired token on 401 and retries original request', async () => {
  authStorage.setAccessToken('mock-expired-token');

  let accessAttempts = 0;
  server.setHandler('GET /protected/resource', (req, res, { formatSuccess, formatError }) => {
    accessAttempts++;
    const auth = req.headers.authorization || '';
    if (auth.includes('mock-expired-token')) {
      res.statusCode = 401;
      return res.end(JSON.stringify(formatError(401, 'Token expired', null, 'TOKEN_EXPIRED')));
    }
    if (auth.includes('refreshed-valid-token')) {
      res.statusCode = 200;
      return res.end(JSON.stringify(formatSuccess({ secretData: 'unlocked-content' })));
    }
    res.statusCode = 401;
    return res.end(JSON.stringify(formatError(401, 'Unauthorized')));
  });

  server.setHandler('POST /auth/refresh', (req, res, { formatSuccess }) => {
    res.statusCode = 200;
    return res.end(JSON.stringify(formatSuccess({ access_token: 'refreshed-valid-token' })));
  });

  const result = await apiClient.requestJson('/protected/resource');

  // Should have succeeded after retry
  assert.deepEqual(result, { secretData: 'unlocked-content' });
  // Total attempts to resource must be 2 (initial failed + retried succeeded)
  assert.equal(accessAttempts, 2);
  // Stored token in authStorage should now be the new refreshed token
  assert.equal(authStorage.getAccessToken(), 'refreshed-valid-token');
});

test('requestJson does not attempt refresh on auth endpoints to avoid loops', async () => {
  server.setHandler('POST /auth/login', (req, res, { formatError }) => {
    res.statusCode = 401;
    return res.end(JSON.stringify(formatError(401, 'Invalid credentials')));
  });

  await assert.rejects(
    async () => {
      await apiClient.requestJson('/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'bad' },
      });
    },
    (err) => {
      assert(err instanceof apiClient.ApiError);
      assert.equal(err.status, 401);
      return true;
    },
  );

  // Verify that /auth/refresh was NEVER called
  const refreshCalls = server.requests.filter((r) => r.path === '/auth/refresh');
  assert.equal(refreshCalls.length, 0);
});

test('requestJson clears access token when token refresh fails with 401', async () => {
  authStorage.setAccessToken('mock-expired-token');

  server.setHandler('GET /needs-auth', (req, res, { formatError }) => {
    res.statusCode = 401;
    return res.end(JSON.stringify(formatError(401, 'Token expired')));
  });

  server.setHandler('POST /auth/refresh', (req, res, { formatError }) => {
    res.statusCode = 401;
    return res.end(JSON.stringify(formatError(401, 'Invalid refresh cookie')));
  });

  await assert.rejects(
    async () => {
      await apiClient.requestJson('/needs-auth');
    },
    (err) => {
      assert(err instanceof apiClient.ApiError);
      assert.equal(err.status, 401);
      return true;
    },
  );

  // authStorage must have cleared the expired token
  assert.equal(authStorage.getAccessToken(), null);
});
