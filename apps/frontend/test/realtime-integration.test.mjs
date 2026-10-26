import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMockApiServer } from './mock-api-server.mjs';
import { ensureEnvironment, resetLocalStorage } from './setup.mjs';

let server;
let supabaseModule;

before(async () => {
  server = createMockApiServer();
  const { baseUrl } = await server.start();
  ensureEnvironment(baseUrl);

  supabaseModule = await import('../src/app/supabase.ts');
});

after(async () => {
  const socket = supabaseModule.getChatSocket();
  if (socket) {
    socket.disconnect();
  }
  const notifSocket = supabaseModule.getNotificationsSocket();
  if (notifSocket) {
    notifSocket.disconnect();
  }
  if (server) {
    await server.stop();
  }
});

beforeEach(() => {
  resetLocalStorage();
  server.clearRequests();
  server.clearHandlers();
});

test('getChatSocket returns null when unauthenticated and connects with JWT when authenticated', async () => {
  // 1. Without token: must return null
  assert.equal(supabaseModule.getChatSocket(), null);

  // 2. Set token in localStorage
  globalThis.localStorage.setItem('access_token', 'realtime-jwt-token-123');

  const socket = supabaseModule.getChatSocket();
  assert.ok(socket, 'Expected chat socket instance');
  assert.equal(socket.auth.token, 'realtime-jwt-token-123');

  // Wait for connection
  await new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.on('connect', resolve);
  });
  assert.equal(socket.connected, true);
});

test('getNotificationsSocket connects to /notifications namespace with credentials', async () => {
  globalThis.localStorage.setItem('access_token', 'notif-token-456');

  const notifSocket = supabaseModule.getNotificationsSocket();
  assert.ok(notifSocket);
  assert.equal(notifSocket.auth.token, 'notif-token-456');

  await new Promise((resolve) => {
    if (notifSocket.connected) return resolve();
    notifSocket.on('connect', resolve);
  });
  assert.equal(notifSocket.connected, true);
});

test('supabase.auth helpers integrate with localStorage and backend endpoints', async () => {
  const testUser = { id: 'usr_supabase_1', email: 'supa@example.com', name: 'Supa User' };
  globalThis.localStorage.setItem('user', JSON.stringify(testUser));
  globalThis.localStorage.setItem('access_token', 'auth_token_supa');

  // 1. supabase.auth.user()
  assert.deepEqual(supabaseModule.supabase.auth.user(), testUser);

  // 2. supabase.auth.refresh() calls /auth/refresh
  server.setHandler('POST /auth/refresh', (req, res, { formatSuccess }) => {
    res.statusCode = 200;
    return res.end(JSON.stringify(formatSuccess({ access_token: 'refreshed-supa-token' })));
  });

  const refreshed = await supabaseModule.supabase.auth.refresh();
  assert.equal(refreshed.access_token, 'refreshed-supa-token');
  assert.equal(globalThis.localStorage.getItem('access_token'), 'refreshed-supa-token');

  // 3. supabase.auth.signOut() calls /auth/logout and clears localStorage
  await supabaseModule.supabase.auth.signOut();
  const logoutReq = server.requests.find((r) => r.path === '/auth/logout');
  assert.ok(logoutReq);
  assert.equal(globalThis.localStorage.getItem('access_token'), null);
  assert.equal(globalThis.localStorage.getItem('user'), null);
});

test('supabase query builder adapts database calls to REST API and handles realtime events', async () => {
  globalThis.localStorage.setItem('access_token', 'builder-token');
  const chatSocket = supabaseModule.getChatSocket();

  await new Promise((resolve) => {
    if (chatSocket.connected) return resolve();
    chatSocket.on('connect', resolve);
  });

  // 1. Select messages for channel
  const selectPromise = new Promise((resolve) => {
    supabaseModule.supabase
      .from('messages')
      .select('*')
      .eq('channel_id', 'chn_query_test')
      .then((res) => resolve(res));
  });

  const selectRes = await selectPromise;
  assert.ok(selectRes.data);
  assert.ok(Array.isArray(selectRes.data));
  const channelReq = server.requests.find((r) => r.path === '/messages/channel/chn_query_test');
  assert.ok(channelReq, 'Expected call to /messages/channel/chn_query_test');

  // 2. Insert message
  const insertPromise = new Promise((resolve) => {
    supabaseModule.supabase
      .from('messages')
      .insert({
        channel_id: 'chn_query_test',
        content: 'Created via Supabase query builder shim',
      })
      .then((res) => resolve(res));
  });

  const insertRes = await insertPromise;
  assert.ok(insertRes.data);
  assert.equal(insertRes.data[0].text, 'Created via Supabase query builder shim');

  // 3. Realtime subscription receives message broadcast
  let receivedRealtime = null;
  const realtimePromise = new Promise((resolve) => {
    supabaseModule.supabase
      .from('messages')
      .eq('channel_id', 'chn_query_test')
      .on('INSERT', (payload) => {
        receivedRealtime = payload;
        resolve(payload);
      })
      .subscribe();
  });

  // Wait a tick for subscription to register listeners on socket
  await new Promise((r) => setTimeout(r, 100));

  // Server broadcasts message:created
  server.chatNamespace.emit('message:created', {
    id: 'msg_rt_1',
    channelId: 'chn_query_test',
    content: 'Realtime incoming broadcast message',
    sent_by: 'user_broadcaster',
    createdAt: new Date().toISOString(),
  });

  await realtimePromise;
  assert.ok(receivedRealtime);
  assert.equal(receivedRealtime.eventType, 'INSERT');
  assert.equal(receivedRealtime.new.text, 'Realtime incoming broadcast message');
  assert.equal(receivedRealtime.new.channel_id, 'chn_query_test');
});
