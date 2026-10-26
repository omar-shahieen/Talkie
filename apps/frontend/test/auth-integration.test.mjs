import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMockApiServer } from './mock-api-server.mjs';
import { ensureEnvironment, resetLocalStorage } from './setup.mjs';

let server;
let authApi;
let authService;
let authStorage;

before(async () => {
  server = createMockApiServer();
  const { baseUrl } = await server.start();
  ensureEnvironment(baseUrl);

  authApi = await import('../src/app/services/auth-api.service.ts');
  authService = await import('../src/app/services/auth.service.ts');
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

test('signup sends registration payload to POST /auth/signup', async () => {
  const payload = {
    firstName: 'Alice',
    lastName: 'Wonderland',
    email: 'alice@example.com',
    username: 'alice_wonder',
    password: 'Password123!',
    passwordConfirm: 'Password123!',
  };

  const result = await authApi.signup(payload);

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/auth/signup');
  assert.equal(req.body.email, 'alice@example.com');
  assert.equal(req.body.username, 'alice_wonder');

  assert.equal(result.email, 'alice@example.com');
  assert.ok(result.id);
});

test('login authenticates credentials and returns access token', async () => {
  const result = await authApi.login({
    email: 'user@example.com',
    password: 'Password123!',
  });

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/auth/login');
  assert.equal(req.body.email, 'user@example.com');

  assert.ok(result.access_token);
  assert.match(result.access_token, /^mock-token-/);
});

test('login handles 2FA challenge and verifyTfa completes authentication', async () => {
  // Step 1: Login with user that has 2FA enabled
  const loginRes = await authApi.login({
    email: 'tfa_user@example.com',
    password: 'require-2fa',
  });

  assert.equal(loginRes.tfaRequired, true);
  assert.equal(loginRes.tfaLoginToken, 'mock-tfa-login-token-123');

  // Step 2: Submit TFA TOTP code with tfaLoginToken
  const verifyRes = await authApi.verifyTfa({
    tfaToken: '123456',
    tfaLoginToken: loginRes.tfaLoginToken,
  });

  assert.equal(server.requests.length, 2);
  const verifyReq = server.requests[1];
  assert.equal(verifyReq.method, 'POST');
  assert.equal(verifyReq.path, '/auth/tfa/verify');
  assert.equal(verifyReq.headers.authorization, 'Bearer mock-tfa-login-token-123');
  assert.equal(verifyReq.body.tfaToken, '123456');

  assert.equal(verifyRes.access_token, 'mock-verified-token');
});

test('requestPasswordReset posts to /auth/forget-passwrod', async () => {
  const res = await authApi.requestPasswordReset('forgot@example.com');

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/auth/forget-passwrod');
  assert.equal(req.body.email, 'forgot@example.com');

  assert.deepEqual(res, { message: 'Password reset email sent' });
});

test('resetPassword posts to /auth/reset-passwrod', async () => {
  const res = await authApi.resetPassword({
    resetToken: 'valid-reset-token-abc',
    newPassword: 'NewPassword123!',
    newPasswordConfirm: 'NewPassword123!',
  });

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/auth/reset-passwrod');
  assert.equal(req.body.resetToken, 'valid-reset-token-abc');
  assert.equal(req.body.newPassword, 'NewPassword123!');

  assert.deepEqual(res, { message: 'Password reset successful' });
});

test('changePassword sends PUT request to /auth/change-password with auth header', async () => {
  authStorage.setAccessToken('user-valid-token');

  const res = await authApi.changePassword({
    oldPassword: 'OldPassword123!',
    newPassword: 'NewPassword123!',
    newPasswordConfirm: 'NewPassword123!',
  });

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.method, 'PUT');
  assert.equal(req.path, '/auth/change-password');
  assert.equal(req.headers.authorization, 'Bearer user-valid-token');
  assert.equal(req.body.oldPassword, 'OldPassword123!');

  assert.deepEqual(res, { message: 'Password changed successfully' });
});

test('initiateTfa requests OTP setup URI from /auth/tfa/initiate', async () => {
  authStorage.setAccessToken('active-token');

  const res = await authApi.initiateTfa();

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/auth/tfa/initiate');
  assert.match(res.uri, /^otpauth:\/\/totp/);
});

test('setTfa calls enable or disable endpoint with TOTP code', async () => {
  authStorage.setAccessToken('active-token');

  // Enable
  const enableRes = await authApi.setTfa('enable', '654321');
  assert.deepEqual(enableRes, { message: '2FA enabled' });
  assert.equal(server.requests[0].path, '/auth/tfa/enable');
  assert.equal(server.requests[0].body.tfaToken, '654321');

  // Disable
  const disableRes = await authApi.setTfa('disable', '654321');
  assert.deepEqual(disableRes, { message: '2FA disabled' });
  assert.equal(server.requests[1].path, '/auth/tfa/disable');
});

test('logoutApi calls POST /auth/logout', async () => {
  authStorage.setAccessToken('token-to-logout');

  await authApi.logoutApi();

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/auth/logout');
});

test('getGoogleAuthUrl generates valid OAuth redirect URL', () => {
  const url = authApi.getGoogleAuthUrl();
  assert.equal(url, `${server.baseUrl}/auth/google`);
});

test('authStorage correctly manages localStorage tokens and migrates legacy tokens', () => {
  assert.equal(authStorage.getAccessToken(), null);
  assert.equal(authService.hasAuthToken(), false);

  // Set standard token
  authStorage.setAccessToken('tok_123');
  assert.equal(authStorage.getAccessToken(), 'tok_123');
  assert.equal(authService.hasAuthToken(), true);

  // Clear token
  authStorage.clearAccessToken();
  assert.equal(authStorage.getAccessToken(), null);
  assert.equal(authService.hasAuthToken(), false);

  // Legacy token migration: 'token' -> 'access_token'
  globalThis.localStorage.setItem('token', 'legacy_token_val');
  assert.equal(authStorage.getAccessToken(), 'legacy_token_val');
  // Should have migrated to 'access_token' and deleted 'token'
  assert.equal(globalThis.localStorage.getItem('access_token'), 'legacy_token_val');
  assert.equal(globalThis.localStorage.getItem('token'), null);
});
