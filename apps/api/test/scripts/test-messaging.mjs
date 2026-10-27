import { io } from 'socket.io-client';

const BASE_URL = 'http://127.0.0.1:3000';
const WS_URL = 'http://127.0.0.1:3000/chat';

const testResults = [];

function recordResult(testName, passed, details = '', error = null) {
  testResults.push({ testName, passed, details, error: error ? String(error) : null });
  const statusMark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusMark}] ${testName}`);
  if (details) console.log(`       Details: ${details}`);
  if (error) console.log(`       Error: ${error.message || error}`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, text, data: json };
}

async function registerAndLogin(userIndex) {
  const ts = Date.now();
  const userData = {
    firstName: `User${userIndex}`,
    lastName: 'Tester',
    username: `msg_user_${userIndex}_${ts}`,
    email: `msg_user_${userIndex}_${ts}@example.com`,
    password: 'Password123!',
    passwordConfirm: 'Password123!',
  };

  const signup = await request('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });

  if (signup.status !== 200 && signup.status !== 201) {
    throw new Error(`Signup failed (${signup.status}): ${signup.text}`);
  }

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userData.email, password: userData.password }),
  });

  if (login.status !== 200) {
    throw new Error(`Login failed (${login.status}): ${login.text}`);
  }

  const token = login.data.results?.access_token || login.data.access_token;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  const userId = payload.sub || payload.id;

  return { token, userId, username: userData.username };
}

async function runTests() {
  console.log('====================================================');
  console.log('TALKIE MESSAGING FEATURES COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  // 1. Setup users & server/channels
  console.log('--- Setting up Test Users and Channels ---');
  const user1 = await registerAndLogin(1);
  const user2 = await registerAndLogin(2);
  console.log(`User 1: ${user1.username} (${user1.userId})`);
  console.log(`User 2: ${user2.username} (${user2.userId})`);

  const auth1 = { Authorization: `Bearer ${user1.token}` };
  const auth2 = { Authorization: `Bearer ${user2.token}` };

  // Create Server A by User 1
  const serverResA = await request('/servers', {
    method: 'POST',
    headers: { ...auth1, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Msg Server A ${Date.now()}` }),
  });
  const serverA = serverResA.data.results || serverResA.data;

  // Get general channel of Server A
  const chResA = await request(`/channels/server/${serverA.id}/visible/${user1.userId}`, {
    headers: auth1,
  });
  const channelsA = chResA.data.results || chResA.data;
  const channelA1 = channelsA[0];

  // Create second channel in Server A
  const createChRes = await request('/channels', {
    method: 'POST',
    headers: { ...auth1, 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverId: serverA.id, name: 'second-channel' }),
  });
  const channelA2 = createChRes.data.results || createChRes.data;

  // Add User 2 to Server A via invitation
  const inviteRes = await request(`/servers/${serverA.id}/invitation`, {
    method: 'POST',
    headers: auth1,
  });
  const invite = inviteRes.data.results || inviteRes.data;
  const inviteCode = invite.inviteCode || invite.code;
  await request(`/invitations/${inviteCode}/accept`, {
    method: 'POST',
    headers: auth2,
  });

  console.log(`Server A ID: ${serverA.id}`);
  console.log(`Channel 1: ${channelA1.name} (${channelA1.id})`);
  console.log(`Channel 2: ${channelA2.name} (${channelA2.id})\n`);

  // ==========================================
  // SECTION 1: Message Creation (REST)
  // ==========================================
  console.log('--- Section 1: Message Creation ---');

  let message1 = null;
  try {
    const res = await request('/messages', {
      method: 'POST',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: 'Hello World! This is message 1.',
      }),
    });
    const data = res.data.results || res.data;
    if (res.status === 201 && data.id && data.content === 'Hello World! This is message 1.') {
      message1 = data;
      recordResult('1.1 Create basic message', true, `Message ID: ${data.id}`);
    } else {
      recordResult('1.1 Create basic message', false, `Status: ${res.status}, response: ${res.text}`);
    }
  } catch (err) {
    recordResult('1.1 Create basic message', false, '', err);
  }

  // Verify Channel's lastMessageId is updated
  try {
    const ch = await request(`/channels/${channelA1.id}`, { headers: auth1 });
    const chData = ch.data.results || ch.data;
    if (chData.lastMessageId === message1?.id) {
      recordResult('1.2 Channel lastMessageId update on message creation', true, `lastMessageId matches ${message1.id}`);
    } else {
      recordResult('1.2 Channel lastMessageId update on message creation', false, `Expected ${message1?.id}, got ${chData.lastMessageId}`);
    }
  } catch (err) {
    recordResult('1.2 Channel lastMessageId update on message creation', false, '', err);
  }

  // 1.3 Create message with attachments
  let messageWithAttachment = null;
  try {
    const res = await request('/messages', {
      method: 'POST',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: 'Message with file attachment',
        attachments: [
          {
            url: 'https://pub-9d2cfb4b880140b29ba06d382c363794.r2.dev/messages/sample.png',
            fileName: 'sample.png',
            mimeType: 'image/png',
            sizeBytes: 1024,
          },
        ],
      }),
    });
    const data = res.data.results || res.data;
    if (res.status === 201 && data.attachments?.length === 1 && data.attachments[0].fileName === 'sample.png') {
      messageWithAttachment = data;
      recordResult('1.3 Create message with attachments', true, `Attachment ID: ${data.attachments[0].id}`);
    } else {
      recordResult('1.3 Create message with attachments', false, `Status: ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('1.3 Create message with attachments', false, '', err);
  }

  // 1.4 Create message with non-existent channel ID -> expect 404
  try {
    const res = await request('/messages', {
      method: 'POST',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: '00000000-0000-0000-0000-000000000000',
        content: 'Should fail',
      }),
    });
    if (res.status === 404) {
      recordResult('1.4 Create message in non-existent channel rejects 404', true, `Status: 404`);
    } else {
      recordResult('1.4 Create message in non-existent channel rejects 404', false, `Expected 404, got ${res.status}`);
    }
  } catch (err) {
    recordResult('1.4 Create message in non-existent channel rejects 404', false, '', err);
  }

  // ==========================================
  // SECTION 2: Message Listing & Pagination
  // ==========================================
  console.log('\n--- Section 2: Message Listing & Pagination ---');

  try {
    // Post 3 more messages to test pagination
    for (let i = 2; i <= 4; i++) {
      await request('/messages', {
        method: 'POST',
        headers: { ...auth1, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channelA1.id,
          content: `Test pagination message ${i}`,
        }),
      });
    }

    const listRes = await request(`/messages/channel/${channelA1.id}?limit=2`, {
      headers: auth1,
    });
    const listData = listRes.data.results || listRes.data;
    if (listRes.status === 200 && listData.items?.length === 2 && listData.nextCursor) {
      recordResult('2.1 List messages with limit and nextCursor', true, `Got 2 items, nextCursor: ${listData.nextCursor}`);

      // Now fetch page 2 using cursor
      const nextRes = await request(`/messages/channel/${channelA1.id}?limit=2&cursor=${encodeURIComponent(listData.nextCursor)}`, {
        headers: auth1,
      });
      const nextData = nextRes.data.results || nextRes.data;
      if (nextRes.status === 200 && nextData.items?.length > 0) {
        recordResult('2.2 Fetch second page using cursor', true, `Page 2 got ${nextData.items.length} items`);
      } else {
        recordResult('2.2 Fetch second page using cursor', false, `Status ${nextRes.status}, body: ${nextRes.text}`);
      }
    } else {
      recordResult('2.1 List messages with limit and nextCursor', false, `Status ${listRes.status}, data: ${JSON.stringify(listData)}`);
    }
  } catch (err) {
    recordResult('2.1 List messages with pagination', false, '', err);
  }

  // ==========================================
  // SECTION 3: Message Editing (PATCH)
  // ==========================================
  console.log('\n--- Section 3: Message Editing ---');

  try {
    const editRes = await request(`/messages/${message1.id}`, {
      method: 'PATCH',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated content for message 1' }),
    });
    const editData = editRes.data.results || editRes.data;
    if (editRes.status === 200 && editData.content === 'Updated content for message 1' && editData.editedAt) {
      recordResult('3.1 Author can edit message', true, `Edited content and editedAt: ${editData.editedAt}`);
    } else {
      recordResult('3.1 Author can edit message', false, `Status ${editRes.status}, body: ${editRes.text}`);
    }
  } catch (err) {
    recordResult('3.1 Author can edit message', false, '', err);
  }

  // 3.2 Non-author attempts to edit -> 403 Forbidden
  try {
    const editRes = await request(`/messages/${message1.id}`, {
      method: 'PATCH',
      headers: { ...auth2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hacked by User 2' }),
    });
    if (editRes.status === 403) {
      recordResult('3.2 Non-author edit rejected 403 Forbidden', true, `Status: 403`);
    } else {
      recordResult('3.2 Non-author edit rejected 403 Forbidden', false, `Expected 403, got ${editRes.status}: ${editRes.text}`);
    }
  } catch (err) {
    recordResult('3.2 Non-author edit rejected 403 Forbidden', false, '', err);
  }

  // 3.3 Edit non-existent message -> 404 NotFound
  try {
    const editRes = await request('/messages/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Non-existent edit' }),
    });
    if (editRes.status === 404) {
      recordResult('3.3 Edit non-existent message returns 404', true, `Status: 404`);
    } else {
      recordResult('3.3 Edit non-existent message returns 404', false, `Expected 404, got ${editRes.status}`);
    }
  } catch (err) {
    recordResult('3.3 Edit non-existent message returns 404', false, '', err);
  }

  // ==========================================
  // SECTION 4: Thread & Reply Features
  // ==========================================
  console.log('\n--- Section 4: Threads & Replies ---');

  let replyMessage = null;
  // 4.1 Create reply to parent message in same channel
  try {
    const res = await request('/messages', {
      method: 'POST',
      headers: { ...auth2, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: 'This is a reply to message 1',
        parentMessageId: message1.id,
      }),
    });
    const data = res.data.results || res.data;
    if (res.status === 201 && data.parentMessageId === message1.id) {
      replyMessage = data;
      recordResult('4.1 Create reply to parent message', true, `Reply ID: ${data.id}`);
    } else {
      recordResult('4.1 Create reply to parent message', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('4.1 Create reply to parent message', false, '', err);
  }

  // 4.2 List replies to message
  try {
    const res = await request(`/messages/${message1.id}/replies`, { headers: auth1 });
    const data = res.data.results || res.data;
    if (res.status === 200 && data.items?.some((m) => m.id === replyMessage?.id)) {
      recordResult('4.2 List replies to message', true, `Found reply in items`);
    } else {
      recordResult('4.2 List replies to message', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('4.2 List replies to message', false, '', err);
  }

  // 4.3 List thread
  try {
    const res = await request(`/messages/${message1.id}/thread`, { headers: auth1 });
    const data = res.data.results || res.data;
    if (res.status === 200 && Array.isArray(data.items)) {
      recordResult('4.3 List message thread', true, `Thread contains ${data.items.length} items`);
    } else {
      recordResult('4.3 List message thread', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('4.3 List message thread', false, '', err);
  }

  // 4.4 Reply to parent from different channel -> expect 400 Bad Request
  try {
    const res = await request('/messages', {
      method: 'POST',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelA2.id, // Channel 2
        content: 'Cross channel reply attempt',
        parentMessageId: message1.id, // Channel 1 message
      }),
    });
    if (res.status === 400) {
      recordResult('4.4 Cross-channel reply rejected 400 Bad Request', true, `Status: 400`);
    } else {
      recordResult('4.4 Cross-channel reply rejected 400 Bad Request', false, `Expected 400, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('4.4 Cross-channel reply rejected 400 Bad Request', false, '', err);
  }

  // 4.5 Reply to non-existent parent message -> expect 404 NotFound
  try {
    const res = await request('/messages', {
      method: 'POST',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: 'Orphan reply attempt',
        parentMessageId: '00000000-0000-0000-0000-000000000000',
      }),
    });
    if (res.status === 404) {
      recordResult('4.5 Reply to non-existent parent rejected 404', true, `Status: 404`);
    } else {
      recordResult('4.5 Reply to non-existent parent rejected 404', false, `Expected 404, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('4.5 Reply to non-existent parent rejected 404', false, '', err);
  }

  // ==========================================
  // SECTION 5: Reactions
  // ==========================================
  console.log('\n--- Section 5: Message Reactions ---');

  // 5.1 Add reaction
  try {
    const res = await request(`/messages/${message1.id}/reactions`, {
      method: 'POST',
      headers: { ...auth2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍' }),
    });
    const data = res.data.results || res.data;
    if ((res.status === 201 || res.status === 200) && data.emoji === '👍') {
      recordResult('5.1 Add emoji reaction to message', true, `Reaction added: 👍`);
    } else {
      recordResult('5.1 Add emoji reaction to message', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('5.1 Add emoji reaction to message', false, '', err);
  }

  // 5.2 Add duplicate reaction (idempotent)
  try {
    const res = await request(`/messages/${message1.id}/reactions`, {
      method: 'POST',
      headers: { ...auth2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍' }),
    });
    const data = res.data.results || res.data;
    if ((res.status === 200 || res.status === 201) && data.emoji === '👍') {
      recordResult('5.2 Add duplicate reaction is idempotent', true, `Status: ${res.status}`);
    } else {
      recordResult('5.2 Add duplicate reaction is idempotent', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('5.2 Add duplicate reaction is idempotent', false, '', err);
  }

  // 5.3 Verify reactions appear when listing channel messages
  try {
    const res = await request(`/messages/channel/${channelA1.id}`, { headers: auth1 });
    const data = res.data.results || res.data;
    const msg = data.items?.find((m) => m.id === message1.id);
    if (msg?.reactions?.some((r) => r.emoji === '👍' && r.userId === user2.userId)) {
      recordResult('5.3 Message relations include reactions', true, `Reaction 👍 found on message`);
    } else {
      recordResult('5.3 Message relations include reactions', false, `Reactions: ${JSON.stringify(msg?.reactions)}`);
    }
  } catch (err) {
    recordResult('5.3 Message relations include reactions', false, '', err);
  }

  // 5.4 Remove reaction
  try {
    const res = await request(`/messages/${message1.id}/reactions`, {
      method: 'DELETE',
      headers: { ...auth2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍' }),
    });
    if (res.status === 200) {
      recordResult('5.4 Remove emoji reaction', true, `Reaction removed`);
    } else {
      recordResult('5.4 Remove emoji reaction', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('5.4 Remove emoji reaction', false, '', err);
  }

  // 5.5 Remove non-existent reaction -> 404
  try {
    const res = await request(`/messages/${message1.id}/reactions`, {
      method: 'DELETE',
      headers: { ...auth2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '❤️' }),
    });
    if (res.status === 404) {
      recordResult('5.5 Remove non-existent reaction returns 404', true, `Status: 404`);
    } else {
      recordResult('5.5 Remove non-existent reaction returns 404', false, `Expected 404, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('5.5 Remove non-existent reaction returns 404', false, '', err);
  }

  // ==========================================
  // SECTION 6: Search Messages
  // ==========================================
  console.log('\n--- Section 6: Search Messages ---');

  try {
    const uniqueTerm = `search_needle_${Date.now()}`;
    await request('/messages', {
      method: 'POST',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: `This message has a unique keyword: ${uniqueTerm}`,
      }),
    });

    const searchRes = await request(`/messages/search/query?keyword=${uniqueTerm}`, {
      headers: auth1,
    });
    const searchData = searchRes.data.results || searchRes.data;
    if (searchRes.status === 200 && searchData.items?.some((m) => m.content.includes(uniqueTerm))) {
      recordResult('6.1 Search messages by keyword', true, `Found message with engine: ${searchData.engine}`);
    } else {
      recordResult('6.1 Search messages by keyword', false, `Status ${searchRes.status}, items: ${JSON.stringify(searchData)}`);
    }

    // Search by channel
    const searchChRes = await request(`/messages/search/query?channelId=${channelA1.id}&limit=5`, {
      headers: auth1,
    });
    const searchChData = searchChRes.data.results || searchChRes.data;
    if (searchChRes.status === 200 && Array.isArray(searchChData.items)) {
      recordResult('6.2 Search messages by channelId', true, `Found ${searchChData.items.length} items`);
    } else {
      recordResult('6.2 Search messages by channelId', false, `Status ${searchChRes.status}`);
    }
  } catch (err) {
    recordResult('6.1 Search messages', false, '', err);
  }

  // ==========================================
  // SECTION 7: Guest Messaging
  // ==========================================
  console.log('\n--- Section 7: Guest Messaging ---');

  const guestUuid = 'c8b2b91d-1577-4a0b-9366-26127e4e1a0b';
  try {
    const guestRes = await request('/messages/guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-user-id': guestUuid,
      },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: 'Guest anonymous comment',
      }),
    });
    const guestData = guestRes.data.results || guestRes.data;
    if (guestRes.status === 201 && guestData.authorId === guestUuid) {
      recordResult('7.1 Guest message creation with valid UUID v4', true, `Guest message ID: ${guestData.id}`);
    } else {
      recordResult('7.1 Guest message creation with valid UUID v4', false, `Status ${guestRes.status}, body: ${guestRes.text}`);
    }
  } catch (err) {
    recordResult('7.1 Guest message creation with valid UUID v4', false, '', err);
  }

  // 7.2 Guest message without valid UUID v4 header -> 400
  try {
    const guestRes = await request('/messages/guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-user-id': 'invalid-uuid',
      },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: 'Invalid guest',
      }),
    });
    if (guestRes.status === 400) {
      recordResult('7.2 Guest message with invalid UUID rejected 400', true, `Status: 400`);
    } else {
      recordResult('7.2 Guest message with invalid UUID rejected 400', false, `Expected 400, got ${guestRes.status}`);
    }
  } catch (err) {
    recordResult('7.2 Guest message with invalid UUID rejected 400', false, '', err);
  }

  // ==========================================
  // SECTION 8: Message Deletion
  // ==========================================
  console.log('\n--- Section 8: Message Deletion ---');

  // Create message to delete
  const msgToDeleteRes = await request('/messages', {
    method: 'POST',
    headers: { ...auth1, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: channelA1.id,
      content: 'Message to be deleted',
    }),
  });
  const msgToDelete = msgToDeleteRes.data.results || msgToDeleteRes.data;

  // 8.1 Non-author attempts to delete -> 403 Forbidden
  try {
    const res = await request(`/messages/${msgToDelete.id}`, {
      method: 'DELETE',
      headers: auth2,
    });
    if (res.status === 403) {
      recordResult('8.1 Non-author delete rejected 403 Forbidden', true, `Status: 403`);
    } else {
      recordResult('8.1 Non-author delete rejected 403 Forbidden', false, `Expected 403, got ${res.status}: ${res.text}`);
    }
  } catch (err) {
    recordResult('8.1 Non-author delete rejected 403 Forbidden', false, '', err);
  }

  // 8.2 Author soft-deletes message
  try {
    const res = await request(`/messages/${msgToDelete.id}`, {
      method: 'DELETE',
      headers: auth1,
    });
    const data = res.data.results || res.data;
    if (res.status === 200 && data.softDeleted === true) {
      recordResult('8.2 Author soft delete message', true, `softDeleted: true`);

      // Verify it is excluded from listChannelMessages
      const listRes = await request(`/messages/channel/${channelA1.id}`, { headers: auth1 });
      const listData = listRes.data.results || listRes.data;
      const exists = listData.items?.some((m) => m.id === msgToDelete.id);
      if (!exists) {
        recordResult('8.3 Soft-deleted message excluded from channel list', true, `Not present in channel message list`);
      } else {
        recordResult('8.3 Soft-deleted message excluded from channel list', false, `Soft-deleted message still returned in channel list!`);
      }
    } else {
      recordResult('8.2 Author soft delete message', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('8.2 Author soft delete message', false, '', err);
  }

  // 8.4 Delete for everyone
  const msgForEveryoneRes = await request('/messages', {
    method: 'POST',
    headers: { ...auth1, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: channelA1.id,
      content: 'Message to delete for everyone',
    }),
  });
  const msgForEveryone = msgForEveryoneRes.data.results || msgForEveryoneRes.data;

  try {
    const res = await request(`/messages/${msgForEveryone.id}?scope=everyone`, {
      method: 'DELETE',
      headers: auth1,
    });
    const data = res.data.results || res.data;
    if (res.status === 200 && data.deletedForEveryone === true) {
      recordResult('8.4 Delete message for everyone', true, `deletedForEveryone: true`);
    } else {
      recordResult('8.4 Delete message for everyone', false, `Status ${res.status}, body: ${res.text}`);
    }
  } catch (err) {
    recordResult('8.4 Delete message for everyone', false, '', err);
  }

  // ==========================================
  // SECTION 9: WebSocket Real-Time Events (/chat)
  // ==========================================
  console.log('\n--- Section 9: WebSocket Real-Time Events ---');

  let socket1 = null;
  let socket2 = null;

  try {
    // Connect User 2 via Socket.IO
    socket2 = io(WS_URL, {
      auth: { token: user2.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket 2 connection timed out')), 5000);
      socket2.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket2.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    recordResult('9.1 Socket connection with JWT auth', true, `Connected with socket id: ${socket2.id}`);

    // User 2 joins channel
    await new Promise((resolve) => {
      socket2.emit('channel:join', { serverId: serverA.id, channelId: channelA1.id }, (ack) => {
        resolve(ack);
      });
      // also give brief tick
      setTimeout(resolve, 300);
    });
    recordResult('9.2 Socket join channel room', true, `Joined channel ${channelA1.id}`);

    // Connect User 1
    socket1 = io(WS_URL, {
      auth: { token: user1.token },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket 1 connection timed out')), 5000);
      socket1.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    // Test Typing Indicator: User 1 emits typing:start -> User 2 receives it
    const typingPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('typing:start event timed out')), 4000);
      socket2.on('typing:start', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    socket1.emit('typing:start', { serverId: serverA.id, channelId: channelA1.id });
    const typingReceived = await typingPromise;
    if (typingReceived.userId === user1.userId && typingReceived.channelId === channelA1.id) {
      recordResult('9.3 Real-time typing:start event propagation', true, `User 2 received typing from User 1`);
    } else {
      recordResult('9.3 Real-time typing:start event propagation', false, `Received: ${JSON.stringify(typingReceived)}`);
    }

    // Test Message Created Real-Time Propagation: User 1 posts REST message -> User 2 receives message:created
    const msgPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('message:created socket event timed out')), 5000);
      socket2.on('message:created', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    const rtPostRes = await request('/messages', {
      method: 'POST',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelA1.id,
        content: 'Real-time broadcast test message',
      }),
    });
    const rtCreatedMsg = rtPostRes.data.results || rtPostRes.data;

    const rtReceived = await msgPromise;
    if (rtReceived.id === rtCreatedMsg.id && rtReceived.content === 'Real-time broadcast test message') {
      recordResult('9.4 Real-time message:created broadcast to channel', true, `User 2 received created message: ${rtReceived.id}`);
    } else {
      recordResult('9.4 Real-time message:created broadcast to channel', false, `Received: ${JSON.stringify(rtReceived)}`);
    }

    // Test Message Updated Real-Time Propagation: User 1 edits message -> User 2 receives message:updated
    const updatePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('message:updated socket event timed out')), 5000);
      socket2.on('message:updated', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    await request(`/messages/${rtCreatedMsg.id}`, {
      method: 'PATCH',
      headers: { ...auth1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Real-time edited content' }),
    });

    const updateReceived = await updatePromise;
    if (updateReceived.id === rtCreatedMsg.id && updateReceived.content === 'Real-time edited content') {
      recordResult('9.5 Real-time message:updated broadcast to channel', true, `User 2 received updated message`);
    } else {
      recordResult('9.5 Real-time message:updated broadcast to channel', false, `Received: ${JSON.stringify(updateReceived)}`);
    }

    // Test Reaction Added Real-Time Propagation: User 2 adds reaction -> User 2 / User 1 receives reaction:added
    const reactionPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('reaction:added socket event timed out')), 5000);
      socket1.on('reaction:added', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    await request(`/messages/${rtCreatedMsg.id}/reactions`, {
      method: 'POST',
      headers: { ...auth2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '🔥' }),
    });

    const reactionReceived = await reactionPromise;
    if (reactionReceived.messageId === rtCreatedMsg.id && reactionReceived.emoji === '🔥') {
      recordResult('9.6 Real-time reaction:added broadcast to channel', true, `User 1 received reaction:added 🔥`);
    } else {
      recordResult('9.6 Real-time reaction:added broadcast to channel', false, `Received: ${JSON.stringify(reactionReceived)}`);
    }

    // Test Message Deleted Real-Time Propagation: User 1 deletes message -> User 2 receives message:deleted
    const deletePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('message:deleted socket event timed out')), 5000);
      socket2.on('message:deleted', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    await request(`/messages/${rtCreatedMsg.id}`, {
      method: 'DELETE',
      headers: auth1,
    });

    const deleteReceived = await deletePromise;
    if (deleteReceived.id === rtCreatedMsg.id) {
      recordResult('9.7 Real-time message:deleted broadcast to channel', true, `User 2 received message:deleted`);
    } else {
      recordResult('9.7 Real-time message:deleted broadcast to channel', false, `Received: ${JSON.stringify(deleteReceived)}`);
    }
  } catch (err) {
    recordResult('9.X WebSocket Real-Time Events', false, '', err);
  } finally {
    if (socket1?.connected) socket1.disconnect();
    if (socket2?.connected) socket2.disconnect();
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n====================================================');
  console.log('TEST RESULTS SUMMARY:');
  console.log('====================================================');
  const total = testResults.length;
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFAILED TESTS:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(` - ${r.testName}: ${r.details || r.error}`);
      });
  }
}

runTests().catch((err) => {
  console.error('FATAL SUITE ERROR:', err);
  process.exit(1);
});
