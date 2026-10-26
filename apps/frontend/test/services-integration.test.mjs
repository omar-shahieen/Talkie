import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMockApiServer } from './mock-api-server.mjs';
import { ensureEnvironment, resetLocalStorage } from './setup.mjs';

let server;
let serverService;
let channelService;
let messageService;
let friendsService;
let rolesService;
let invitationService;
let userService;
let notificationService;
let accessControlService;
let authStorage;

before(async () => {
  server = createMockApiServer();
  const { baseUrl } = await server.start();
  ensureEnvironment(baseUrl);

  serverService = await import('../src/app/services/server.service.ts');
  channelService = await import('../src/app/services/channel.service.ts');
  messageService = await import('../src/app/services/message.service.ts');
  friendsService = await import('../src/app/services/friends.service.ts');
  rolesService = await import('../src/app/services/roles.service.ts');
  invitationService = await import('../src/app/services/invitation.service.ts');
  userService = await import('../src/app/services/user.service.ts');
  notificationService = await import('../src/app/services/notification.service.ts');
  accessControlService = await import('../src/app/services/access-control.service.ts');
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

// --- Server Service Integration ---
test('serverService manages server lifecycle via REST endpoints', async () => {
  authStorage.setAccessToken('auth-token-123');

  // 1. Create server
  const created = await serverService.createServer({
    name: 'Dev Community',
    ownerId: 'user_dev',
    isPublic: true,
  });
  assert.ok(created.id);
  assert.equal(created.name, 'Dev Community');
  assert.equal(created.isPublic, true);

  // 2. Fetch all servers
  const allServers = await serverService.fetchServers();
  assert.ok(Array.isArray(allServers));
  assert.equal(allServers.length, 1);
  assert.equal(allServers[0].id, created.id);

  // 3. Fetch user servers
  const myServers = await serverService.fetchMyServers('user_dev');
  assert.equal(myServers.length, 1);

  // 4. Discover public servers
  const discovered = await serverService.discoverPublicServers({ query: 'Dev' });
  assert.equal(discovered.length, 1);

  // 5. Rename server
  const renamed = await serverService.renameServer(created.id, 'Renamed Community');
  assert.equal(renamed.name, 'Renamed Community');

  // 6. Create and list server invitations
  const invite = await serverService.createServerInvitation(created.id, 48);
  assert.ok(invite.inviteCode);
  const invites = await serverService.fetchServerInvitations(created.id);
  assert.equal(invites.length, 1);
  assert.equal(invites[0].inviteCode, invite.inviteCode);

  // 7. Leave server
  await serverService.leaveServer(created.id, 'user_dev');
  const leaveReq = server.requests.find((r) => r.path.includes('/leave/'));
  assert.equal(leaveReq.method, 'DELETE');

  // 8. Delete server
  await serverService.deleteServer(created.id, 'user_dev');
  const delReq = server.requests.find((r) => r.path === `/servers/${created.id}` && r.method === 'DELETE');
  assert.equal(delReq.query.requesterId, 'user_dev');
});

// --- Channel Service Integration ---
test('channelService manages channels and acknowledgements', async () => {
  authStorage.setAccessToken('auth-token-123');

  // 1. Create channel
  const created = await channelService.createChannel({
    name: 'announcements',
    serverId: 'srv_test_1',
  });
  assert.ok(created.id);
  assert.equal(created.name, 'announcements');

  // 2. List visible channels by server
  const visible = await channelService.fetchVisibleChannelsByServer('srv_test_1', 'user_dev');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].name, 'announcements');

  // 3. Rename channel
  const renamed = await channelService.renameChannel(created.id, 'general-chat');
  assert.equal(renamed.name, 'general-chat');

  // 4. Acknowledge channel read receipt
  await channelService.acknowledgeChannel(created.id, 'msg_last_123');
  const ackReq = server.requests.find((r) => r.path === `/channels/${created.id}/ack`);
  assert.equal(ackReq.method, 'POST');
  assert.equal(ackReq.body.messageId, 'msg_last_123');

  // 5. Delete channel
  await channelService.deleteChannel(created.id);
  const delReq = server.requests.find((r) => r.path === `/channels/${created.id}` && r.method === 'DELETE');
  assert.equal(delReq.method, 'DELETE');
});

// --- Message Service Integration ---
test('messageService sends, normalizes, edits, and deletes messages', async () => {
  authStorage.setAccessToken('user-chat-token');
  globalThis.localStorage.setItem('user', JSON.stringify({ id: 'user_current', name: 'Current User' }));

  // 1. Send authenticated message
  const sent = await messageService.sendMessage({
    channelId: 'chn_main',
    content: 'Hello everyone!',
    parentMessageId: null,
  });
  assert.ok(sent.id);
  assert.equal(sent.text, 'Hello everyone!');
  assert.equal(sent.channel_id, 'chn_main');
  assert.equal(sent.sent_by, 'user_current');

  // 2. Fetch channel messages and verify normalization
  const messages = await messageService.fetchMessages('chn_main');
  assert.ok(Array.isArray(messages));
  assert.ok(messages.length >= 1);
  const first = messages[0];
  assert.ok(first.text !== undefined);
  assert.ok(first.channel_id !== undefined);
  assert.ok(Array.isArray(first.reactions));
  assert.ok(Array.isArray(first.attachments));

  // 3. Edit message
  await messageService.editMessage(sent.id, 'Updated message content');
  const editReq = server.requests.find((r) => r.path === `/messages/${sent.id}` && r.method === 'PATCH');
  assert.equal(editReq.body.content, 'Updated message content');

  // 4. Toggle reaction (add then remove)
  await messageService.toggleMessageReaction(sent.id, '🔥', false);
  const addReactReq = server.requests.find((r) => r.path === `/messages/${sent.id}/reactions` && r.method === 'POST');
  assert.equal(addReactReq.body.emoji, '🔥');

  await messageService.toggleMessageReaction(sent.id, '🔥', true);
  const delReactReq = server.requests.find((r) => r.path === `/messages/${sent.id}/reactions` && r.method === 'DELETE');
  assert.equal(delReactReq.body.emoji, '🔥');

  // 5. Delete for everyone
  await messageService.deleteMessageForEveryone(sent.id);
  const delEveryoneReq = server.requests.find((r) => r.path === `/messages/${sent.id}` && r.method === 'DELETE');
  assert.equal(delEveryoneReq.query.scope, 'everyone');

  // 6. Search messages
  const searchResults = await messageService.searchMessages({
    keyword: 'announcement',
    channelId: 'chn_main',
    limit: 5,
  });
  assert.ok(Array.isArray(searchResults.items));
  assert.equal(searchResults.total, 1);
});

test('messageService sends guest messages to /messages/guest with x-guest-user-id header', async () => {
  // Clear any auth token so guest route is triggered
  authStorage.clearAccessToken();

  const guestId = '12345678-1234-4234-8234-123456789abc';
  const sent = await messageService.sendMessage({
    channelId: 'chn_guest',
    content: 'Guest visitor message',
    guestUserId: guestId,
  });

  const req = server.requests.find((r) => r.path === '/messages/guest');
  assert.ok(req, 'Expected call to /messages/guest');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers['x-guest-user-id'], guestId);
  assert.equal(sent.text, 'Guest visitor message');
});

test('messageService uploadMessageFiles sends FormData to /files/upload and normalizes attachments', async () => {
  authStorage.setAccessToken('auth-token-123');

  const file1 = new File(['dummy binary content'], 'photo.png', { type: 'image/png' });
  const attachments = await messageService.uploadMessageFiles('chn_upload', [file1]);

  assert.equal(server.requests.length, 1);
  const req = server.requests[0];
  assert.equal(req.path, '/files/upload');
  assert.equal(req.method, 'POST');
  assert.ok(req.headers['content-type'].includes('multipart/form-data'));

  assert.ok(Array.isArray(attachments));
  assert.equal(attachments.length, 1);
  // Attachment blob URL should be normalized from /image/blob to /file/blob
  assert.match(attachments[0].url, /\/file\/blob\//);
});

// --- Friends Service Integration ---
test('friendsService handles friend requests and friendships', async () => {
  authStorage.setAccessToken('auth-token-123');

  // 1. Send friend request
  const sent = await friendsService.sendFriendRequest('user_target_456');
  assert.ok(sent.id);
  assert.equal(sent.receiverId, 'user_target_456');

  // 2. Accept friend request
  await friendsService.acceptFriendRequest(sent.id);
  const acceptReq = server.requests.find((r) => r.path === `/friendRequests/${sent.id}/accept`);
  assert.equal(acceptReq.method, 'PATCH');

  // 3. Reject friend request
  await friendsService.rejectFriendRequest('freq_to_reject');
  const rejectReq = server.requests.find((r) => r.path === `/friendRequests/freq_to_reject/reject`);
  assert.equal(rejectReq.method, 'PATCH');

  // 4. Cancel friend request
  await friendsService.cancelFriendRequest('freq_to_cancel');
  const cancelReq = server.requests.find((r) => r.path === `/friendRequests/freq_to_cancel`);
  assert.equal(cancelReq.method, 'DELETE');

  // 5. Incoming & outgoing requests
  const incoming = await friendsService.fetchIncomingFriendRequests();
  assert.ok(Array.isArray(incoming));
  const outgoing = await friendsService.fetchOutgoingFriendRequests();
  assert.ok(Array.isArray(outgoing));

  // 6. Friends list
  const friends = await friendsService.fetchFriends();
  assert.ok(Array.isArray(friends));

  // 7. Unfriend
  await friendsService.unfriend('user_target_456');
  const unfriendReq = server.requests.find((r) => r.path === '/friends/user_target_456');
  assert.equal(unfriendReq.method, 'DELETE');
});

// --- Roles Service Integration ---
test('rolesService creates, lists, updates, and deletes server roles', async () => {
  authStorage.setAccessToken('auth-token-123');

  // 1. Create role
  const role = await rolesService.createRole({
    name: 'Moderator',
    serverId: 'srv_1',
    permissions: '1024',
    position: 2,
  });
  assert.ok(role.id);
  assert.equal(role.name, 'Moderator');

  // 2. Fetch roles
  const roles = await rolesService.fetchRoles();
  assert.ok(Array.isArray(roles));

  // 3. Update role
  const updated = await rolesService.updateRole(role.id, { name: 'Senior Moderator' });
  assert.equal(updated.name, 'Senior Moderator');

  // 4. Delete role
  await rolesService.deleteRole(role.id);
  const delReq = server.requests.find((r) => r.path === `/roles/${role.id}` && r.method === 'DELETE');
  assert.equal(delReq.method, 'DELETE');
});

// --- Invitations Service Integration ---
test('invitationService resolves, accepts, and deletes invite codes', async () => {
  authStorage.setAccessToken('auth-token-123');

  // 1. Resolve invitation code
  const invitation = await invitationService.resolveInvitation('talkie-vip');
  assert.equal(invitation.inviteCode, 'talkie-vip');
  assert.equal(invitation.name, 'Talkie Community');
  assert.equal(invitation.memberCount, 42);

  // 2. Accept invitation
  await invitationService.acceptInvitation('talkie-vip');
  const acceptReq = server.requests.find((r) => r.path === '/invitations/talkie-vip/accept');
  assert.equal(acceptReq.method, 'POST');

  // 3. Delete invitation
  await invitationService.removeInvitation('talkie-vip');
  const delReq = server.requests.find((r) => r.path === '/invitations/talkie-vip' && r.method === 'DELETE');
  assert.equal(delReq.method, 'DELETE');
});

// --- User & Notification & Access Control Integration ---
test('userService, notificationService, and accessControlService communicate with API', async () => {
  authStorage.setAccessToken('auth-token-123');

  // 1. User profile and search
  const me = await userService.fetchCurrentUser();
  assert.equal(me.username, 'current_user');
  assert.equal(me.appRole, 'admin');

  const users = await userService.fetchUsers();
  assert.ok(Array.isArray(users));
  assert.equal(users.length, 2);

  const matched = await userService.searchUsers('alice');
  assert.ok(Array.isArray(matched));
  assert.equal(matched[0].username, 'matched_alice');

  // 2. Notifications
  const notifs = await notificationService.fetchNotifications();
  assert.ok(Array.isArray(notifs));
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].title, 'New Message');
  assert.equal(notifs[0].isRead, false);

  await notificationService.markNotificationAsRead('notif_1');
  const readReq = server.requests.find((r) => r.path === '/notifications/notif_1/read');
  assert.equal(readReq.method, 'PATCH');

  // 3. Access Control
  const appAccess = await accessControlService.resolveAppAccess();
  assert.equal(appAccess.message, 'app permissions work');

  const srvAccess = await accessControlService.resolveServerAccess('user_1', 'srv_1');
  assert.equal(srvAccess.message, 'server permissions work');
});
