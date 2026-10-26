import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

export function createMockApiServer() {
  const requests = [];
  const customHandlers = new Map();
  let server = null;
  let io = null;
  let chatNamespace = null;
  let notifNamespace = null;
  let port = 0;
  let baseUrl = '';

  // In-memory state
  const state = {
    users: new Map(),
    sessions: new Map(), // token -> userId
    refreshTokens: new Map(), // refreshToken -> userId
    servers: new Map(),
    channels: new Map(),
    messages: new Map(), // channelId -> array
    invitations: new Map(), // inviteCode -> invitation
    friends: new Map(), // requestId -> req
    roles: new Map(), // roleId -> role
    notifications: new Map(), // userId -> array
  };

  function parseCookies(cookieHeader = '') {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach((part) => {
      const [key, ...vals] = part.trim().split('=');
      if (key) cookies[key] = decodeURIComponent(vals.join('='));
    });
    return cookies;
  }

  function formatSuccess(results, message = 'Operation completed successfully') {
    return {
      success: true,
      message,
      results: results !== undefined ? results : null,
      timestamp: new Date().toISOString(),
    };
  }

  function formatError(statusCode, message, errors = null, errorCode = 'ERROR') {
    return {
      success: false,
      statusCode,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      ...(errors ? { errors } : {}),
    };
  }

  function handleHttpRequest(req, res) {
    const parsedUrl = new URL(req.url, baseUrl || `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams.entries());
    const cookies = parseCookies(req.headers.cookie);

    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });

    req.on('end', () => {
      let body = null;
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json') && rawBody.trim()) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = rawBody;
        }
      } else if (rawBody) {
        body = rawBody;
      }

      const reqRecord = {
        method: req.method,
        path: pathname,
        url: req.url,
        query,
        headers: req.headers,
        cookies,
        body,
        rawBody,
      };
      requests.push(reqRecord);

      // Check custom handler override first
      const handlerKey = `${req.method.toUpperCase()} ${pathname}`;
      for (const [pattern, handler] of customHandlers.entries()) {
        if (pattern === handlerKey || (pattern instanceof RegExp && pattern.test(handlerKey))) {
          return handler(reqRecord, res, { formatSuccess, formatError });
        }
      }

      // Default REST Mock Implementation matching NestJS backend
      res.setHeader('Content-Type', 'application/json');

      // 1. Auth routes
      if (pathname === '/auth/signup' && req.method === 'POST') {
        const { email, username, firstName, lastName, password } = body || {};
        if (!email || !username) {
          res.statusCode = 400;
          return res.end(JSON.stringify(formatError(400, 'Validation failed', {
            email: email ? [] : ['email must be an email'],
            username: username ? [] : ['username must be longer than 3 characters'],
          })));
        }
        const user = {
          id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          email,
          username,
          firstName: firstName || 'Test',
          lastName: lastName || 'User',
          appRole: 'user',
        };
        state.users.set(user.id, user);
        res.statusCode = 201;
        return res.end(JSON.stringify(formatSuccess(user, 'User registered successfully')));
      }

      if (pathname === '/auth/login' && req.method === 'POST') {
        const { email, password } = body || {};
        if (password === 'require-2fa') {
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess({
            tfaRequired: true,
            tfaLoginToken: 'mock-tfa-login-token-123',
          })));
        }

        if (password === 'wrong-pass') {
          res.statusCode = 401;
          return res.end(JSON.stringify(formatError(401, 'Invalid credentials', null, 'UNAUTHORIZED')));
        }

        const token = `mock-token-${Date.now()}`;
        const refreshToken = `mock-refresh-${Date.now()}`;
        res.setHeader('Set-Cookie', `jwt_refresh=${refreshToken}; HttpOnly; Path=/auth/refresh`);
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ access_token: token })));
      }

      if (pathname === '/auth/refresh' && req.method === 'POST') {
        const cookie = cookies.jwt_refresh;
        if (!cookie || cookie === 'invalid-refresh') {
          res.statusCode = 401;
          return res.end(JSON.stringify(formatError(401, 'Refresh token rejected', null, 'UNAUTHORIZED')));
        }
        const newToken = `mock-refreshed-token-${Date.now()}`;
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ access_token: newToken })));
      }

      if (pathname === '/auth/tfa/verify' && req.method === 'POST') {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.includes('mock-tfa-login-token')) {
          res.statusCode = 401;
          return res.end(JSON.stringify(formatError(401, 'Invalid TFA login token')));
        }
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ access_token: 'mock-verified-token' })));
      }

      if (pathname === '/auth/forget-passwrod' && req.method === 'POST') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ message: 'Password reset email sent' })));
      }

      if (pathname === '/auth/reset-passwrod' && req.method === 'POST') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ message: 'Password reset successful' })));
      }

      if (pathname === '/auth/change-password' && req.method === 'PUT') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ message: 'Password changed successfully' })));
      }

      if (pathname === '/auth/tfa/initiate' && req.method === 'POST') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ uri: 'otpauth://totp/Talkie:test@example.com?secret=JBSWY3DPEHPK3PXP' })));
      }

      if ((pathname === '/auth/tfa/enable' || pathname === '/auth/tfa/disable') && req.method === 'POST') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ message: `2FA ${pathname.includes('enable') ? 'enabled' : 'disabled'}` })));
      }

      if (pathname === '/auth/logout' && req.method === 'POST') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ message: 'Logged out' })));
      }

      // Check simulated expired token triggering 401 refresh flow
      const authHeader = req.headers.authorization || '';
      if (authHeader === 'Bearer mock-expired-token') {
        res.statusCode = 401;
        return res.end(JSON.stringify(formatError(401, 'Access token expired', null, 'TOKEN_EXPIRED')));
      }

      // 2. Users routes
      if (pathname === '/users/me' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({
          id: 'user_current',
          email: 'current@example.com',
          username: 'current_user',
          firstName: 'Current',
          lastName: 'User',
          appRole: 'admin',
        })));
      }

      if (pathname === '/users' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { id: 'user_1', username: 'user_one', email: 'one@example.com' },
          { id: 'user_2', username: 'user_two', email: 'two@example.com' },
        ])));
      }

      if (pathname === '/users/search' && req.method === 'GET') {
        const q = query.q || '';
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { id: 'user_match', username: `matched_${q}`, email: `${q}@example.com` },
        ])));
      }

      // 3. Servers routes
      if (pathname === '/servers' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess(Array.from(state.servers.values()))));
      }

      if (pathname.startsWith('/servers/mine/') && req.method === 'GET') {
        const userId = pathname.split('/').pop();
        const userServers = Array.from(state.servers.values()).filter((s) => s.ownerId === userId);
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess(userServers)));
      }

      if (pathname === '/servers/discovery/public' && req.method === 'GET') {
        const publicServers = Array.from(state.servers.values()).filter((s) => s.isPublic);
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess(publicServers)));
      }

      if (pathname === '/servers' && req.method === 'POST') {
        const serverObj = {
          id: `srv_${Date.now()}`,
          name: body?.name || 'Untitled Server',
          ownerId: body?.ownerId || 'user_current',
          isPublic: Boolean(body?.isPublic),
        };
        state.servers.set(serverObj.id, serverObj);
        res.statusCode = 201;
        return res.end(JSON.stringify(formatSuccess(serverObj)));
      }

      const serverDetailMatch = pathname.match(/^\/servers\/([^\/]+)$/);
      if (serverDetailMatch) {
        const srvId = serverDetailMatch[1];
        if (req.method === 'PATCH') {
          const existing = state.servers.get(srvId) || { id: srvId, name: 'Old Name' };
          const updated = { ...existing, ...body };
          state.servers.set(srvId, updated);
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess(updated)));
        }
        if (req.method === 'DELETE') {
          state.servers.delete(srvId);
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess({ deleted: true })));
        }
      }

      if (pathname.match(/^\/servers\/[^\/]+\/leave\/[^\/]+$/) && req.method === 'DELETE') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ left: true })));
      }

      const serverInviteMatch = pathname.match(/^\/servers\/([^\/]+)\/invitation$/);
      if (serverInviteMatch) {
        const srvId = serverInviteMatch[1];
        if (req.method === 'POST') {
          const inv = {
            inviteCode: `inv_${Date.now()}`,
            serverId: srvId,
            expiresInHours: body?.expiresInHours || 24,
            createdAt: new Date().toISOString(),
          };
          state.invitations.set(inv.inviteCode, inv);
          res.statusCode = 201;
          return res.end(JSON.stringify(formatSuccess(inv)));
        }
        if (req.method === 'GET') {
          const invs = Array.from(state.invitations.values()).filter((i) => i.serverId === srvId);
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess(invs)));
        }
      }

      // 4. Channels routes
      if (pathname === '/channels' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess(Array.from(state.channels.values()))));
      }

      if (pathname.startsWith('/channels/server/') && pathname.includes('/visible/') && req.method === 'GET') {
        const parts = pathname.split('/');
        const srvId = parts[3];
        const channels = Array.from(state.channels.values()).filter((c) => c.serverId === srvId);
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess(channels)));
      }

      if (pathname === '/channels' && req.method === 'POST') {
        const channel = {
          id: `chn_${Date.now()}`,
          name: body?.name || 'general',
          serverId: body?.serverId || 'srv_1',
        };
        state.channels.set(channel.id, channel);
        res.statusCode = 201;
        return res.end(JSON.stringify(formatSuccess(channel)));
      }

      const channelDetailMatch = pathname.match(/^\/channels\/([^\/]+)$/);
      if (channelDetailMatch) {
        const chnId = channelDetailMatch[1];
        if (req.method === 'GET') {
          const chn = state.channels.get(chnId) || { id: chnId, name: 'general', serverId: 'srv_1' };
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess(chn)));
        }
        if (req.method === 'PATCH') {
          const existing = state.channels.get(chnId) || { id: chnId, name: 'old' };
          const updated = { ...existing, ...body };
          state.channels.set(chnId, updated);
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess(updated)));
        }
        if (req.method === 'DELETE') {
          state.channels.delete(chnId);
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess({ deleted: true })));
        }
      }

      if (pathname.match(/^\/channels\/[^\/]+\/ack$/) && req.method === 'POST') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ acknowledged: true })));
      }

      // 5. Messages routes
      if ((pathname === '/messages' || pathname === '/messages/guest') && req.method === 'POST') {
        const msg = {
          id: `msg_${Date.now()}`,
          channelId: body?.channelId || 'chn_1',
          content: body?.content || '',
          senderId: pathname === '/messages/guest' ? req.headers['x-guest-user-id'] || 'guest_user' : 'user_current',
          createdAt: new Date().toISOString(),
          parentMessageId: body?.parentMessageId || null,
          threadRootMessageId: body?.threadRootMessageId || null,
          attachments: body?.attachments || [],
          reactions: [],
        };
        const list = state.messages.get(msg.channelId) || [];
        list.push(msg);
        state.messages.set(msg.channelId, list);

        // Realtime broadcast via Socket.IO if connected
        if (chatNamespace) {
          chatNamespace.emit('message:created', msg);
        }

        res.statusCode = 201;
        return res.end(JSON.stringify(formatSuccess(msg)));
      }

      if (pathname.startsWith('/messages/channel/') && req.method === 'GET') {
        const chnId = pathname.split('/').pop();
        const list = state.messages.get(chnId) || [
          {
            id: 'msg_seed_1',
            channel_id: chnId,
            content: 'Hello World',
            author_id: 'user_seed',
            createdAt: new Date().toISOString(),
            reactions: [{ emoji: '👍', userId: 'user_1' }],
            attachments: [{ url: '/image/blob/test.png', fileName: 'test.png' }],
          },
        ];
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess(list)));
      }

      const msgDetailMatch = pathname.match(/^\/messages\/([^\/]+)$/);
      if (msgDetailMatch) {
        const msgId = msgDetailMatch[1];
        if (req.method === 'PATCH') {
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess({ id: msgId, content: body?.content, updatedAt: new Date().toISOString() })));
        }
        if (req.method === 'DELETE') {
          const isEveryone = query.scope === 'everyone';
          if (chatNamespace) {
            chatNamespace.emit(isEveryone ? 'message:deletedForEveryone' : 'message:deleted', { id: msgId });
          }
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess({ deleted: true, scope: query.scope || 'user' })));
        }
      }

      if (pathname.match(/^\/messages\/[^\/]+\/thread$/) && req.method === 'GET') {
        const msgId = pathname.split('/')[2];
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { id: `thread_reply_${msgId}`, content: 'Thread reply', channelId: 'chn_1', threadRootMessageId: msgId },
        ])));
      }

      if (pathname.match(/^\/messages\/[^\/]+\/reactions$/)) {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ success: true })));
      }

      if (pathname === '/messages/search/query' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({
          items: [
            { id: 'msg_search_1', content: `Found keyword: ${query.keyword}`, channelId: query.channelId || 'chn_1' },
          ],
          total: 1,
        })));
      }

      // 6. Files upload
      if (pathname === '/files/upload' && req.method === 'POST') {
        res.statusCode = 201;
        return res.end(JSON.stringify(formatSuccess({
          count: 1,
          attachments: [
            {
              url: 'http://127.0.0.1:3000/image/blob/uploaded_123.webp',
              fileName: 'photo.webp',
              mimeType: 'image/webp',
              sizeBytes: 1024,
            },
          ],
        })));
      }

      // 7. Friends
      if (pathname === '/friendRequests' && req.method === 'POST') {
        const reqObj = {
          id: `freq_${Date.now()}`,
          senderId: 'user_current',
          receiverId: body?.receiverId,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        state.friends.set(reqObj.id, reqObj);
        res.statusCode = 201;
        return res.end(JSON.stringify(formatSuccess(reqObj)));
      }

      const friendReqActionMatch = pathname.match(/^\/friendRequests\/([^\/]+)\/(accept|reject)$/);
      if (friendReqActionMatch && req.method === 'PATCH') {
        const [, reqId, action] = friendReqActionMatch;
        res.statusCode = 204;
        return res.end();
      }

      if (pathname.match(/^\/friendRequests\/[^\/]+$/) && req.method === 'DELETE') {
        res.statusCode = 204;
        return res.end();
      }

      if (pathname === '/friendRequests/incoming' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { id: 'freq_inc_1', senderId: 'user_other', receiverId: 'user_current', status: 'pending' },
        ])));
      }

      if (pathname === '/friendRequests/outgoing' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { id: 'freq_out_1', senderId: 'user_current', receiverId: 'user_other', status: 'pending' },
        ])));
      }

      if (pathname === '/friends' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { userId1: 'user_current', userId2: 'user_friend_1', createdAt: new Date().toISOString() },
        ])));
      }

      if (pathname.startsWith('/friends/') && req.method === 'DELETE') {
        res.statusCode = 204;
        return res.end();
      }

      // 8. Roles
      if (pathname === '/roles' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { id: 'role_admin', name: 'Admin', serverId: 'srv_1', position: 1, permissions: '8', isEveryone: false },
        ])));
      }

      if (pathname === '/roles' && req.method === 'POST') {
        const role = {
          id: `role_${Date.now()}`,
          name: body?.name || 'Moderator',
          serverId: body?.serverId || 'srv_1',
          position: body?.position || 0,
          permissions: body?.permissions || '0',
          isEveryone: Boolean(body?.isEveryone),
        };
        state.roles.set(role.id, role);
        res.statusCode = 201;
        return res.end(JSON.stringify(formatSuccess(role)));
      }

      if (pathname.startsWith('/roles/') && req.method === 'PATCH') {
        const roleId = pathname.split('/')[2];
        const updated = { id: roleId, name: body?.name || 'Updated', ...body };
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess(updated)));
      }

      if (pathname.startsWith('/roles/') && req.method === 'DELETE') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ deleted: true })));
      }

      // 9. Invitations
      const invMatch = pathname.match(/^\/invitations\/([^\/]+)$/);
      if (invMatch) {
        const code = invMatch[1];
        if (req.method === 'GET') {
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess({
            inviteCode: code,
            serverId: 'srv_1',
            inviterId: 'user_owner',
            name: 'Talkie Community',
            memberCount: 42,
          })));
        }
        if (req.method === 'DELETE') {
          res.statusCode = 200;
          return res.end(JSON.stringify(formatSuccess({ deleted: true })));
        }
      }

      if (pathname.match(/^\/invitations\/[^\/]+\/accept$/) && req.method === 'POST') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ joined: true })));
      }

      // 10. Notifications
      if (pathname === '/notifications' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess([
          { id: 'notif_1', title: 'New Message', content: 'You have a mention', isRead: false, createdAt: new Date().toISOString() },
        ])));
      }

      if (pathname.match(/^\/notifications\/[^\/]+\/read$/) && req.method === 'PATCH') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ read: true })));
      }

      // 11. Access Control
      if (pathname === '/access-control/resolveApp' && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ message: 'app permissions work' })));
      }

      if (pathname.startsWith('/access-control/resolveServer/') && req.method === 'GET') {
        res.statusCode = 200;
        return res.end(JSON.stringify(formatSuccess({ message: 'server permissions work' })));
      }

      // Catch-all 404
      res.statusCode = 404;
      return res.end(JSON.stringify(formatError(404, `Endpoint ${req.method} ${pathname} not found`, null, 'NOT_FOUND')));
    });
  }

  async function start(targetPort = 0) {
    server = http.createServer(handleHttpRequest);
    await new Promise((resolve) => {
      server.listen(targetPort, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Attach Socket.IO
    io = new SocketIOServer(server, {
      cors: { origin: '*' },
    });

    chatNamespace = io.of('/chat');
    chatNamespace.on('connection', (socket) => {
      socket.on('server:join', (serverId) => {
        socket.join(`server:${serverId}`);
      });
      socket.on('channel:join', ({ serverId, channelId }) => {
        socket.join(`channel:${channelId}`);
      });
      socket.on('dm:join', ({ channelId }) => {
        socket.join(`dm:${channelId}`);
      });
      socket.on('presence:heartbeat', () => {
        socket.emit('presence:heartbeat:ack', { timestamp: Date.now() });
      });
    });

    notifNamespace = io.of('/notifications');

    return { port, baseUrl };
  }

  async function stop() {
    if (io) {
      await new Promise((resolve) => io.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  function setHandler(pattern, handler) {
    customHandlers.set(pattern, handler);
  }

  function clearHandlers() {
    customHandlers.clear();
  }

  function clearRequests() {
    requests.length = 0;
  }

  return {
    start,
    stop,
    setHandler,
    clearHandlers,
    clearRequests,
    get requests() {
      return requests;
    },
    get state() {
      return state;
    },
    get chatNamespace() {
      return chatNamespace;
    },
    get notifNamespace() {
      return notifNamespace;
    },
    get baseUrl() {
      return baseUrl;
    },
    get port() {
      return port;
    },
  };
}
