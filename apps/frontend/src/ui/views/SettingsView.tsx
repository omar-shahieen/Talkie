import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  changePassword as changePasswordRequest,
  initiateTfa as initiateTfaRequest,
  setTfa,
} from '../../app/services/auth-api.service';
import {
  createChannel as createChannelRequest,
  deleteChannel as deleteChannelRequest,
  fetchChannels,
  renameChannel as renameChannelRequest,
} from '../../app/services/channel.service';
import {
  fetchNotifications,
  markNotificationAsRead as markNotificationAsReadRequest,
} from '../../app/services/notification.service';
import {
  createServerInvitation,
  createServer as createServerRequest,
  deleteServer as deleteServerRequest,
  fetchServerInvitations,
  fetchServers,
  leaveServer as leaveServerRequest,
  renameServer as renameServerRequest,
} from '../../app/services/server.service';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchOutgoingFriendRequests,
  rejectFriendRequest,
  sendFriendRequest,
  unfriend,
} from '../../app/services/friends.service';
import {
  acceptInvitation,
  resolveInvitation,
} from '../../app/services/invitation.service';
import {
  searchUsers,
  UserPayload,
} from '../../app/services/user.service';

function SettingsView() {
  const [servers, setServers] = useState<any[] | null>([]);
  const [channels, setChannels] = useState<any[] | null>([]);
  const [notifications, setNotifications] = useState<any[] | null>([]);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changePasswordStatus, setChangePasswordStatus] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [tfaToken, setTfaToken] = useState('');
  const [tfaStatus, setTfaStatus] = useState('');
  const [tfaUri, setTfaUri] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelServerId, setNewChannelServerId] = useState('');
  const [createChannelStatus, setCreateChannelStatus] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerPublic, setNewServerPublic] = useState(false);
  const [createServerStatus, setCreateServerStatus] = useState('');
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[] | null>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[] | null>([]);
  const [friends, setFriends] = useState<any[] | null>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<UserPayload[]>([]);
  const [selectedFriendUser, setSelectedFriendUser] =
    useState<UserPayload | null>(null);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [friendStatus, setFriendStatus] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [invitationStatus, setInvitationStatus] = useState('');
  const [invitationPreview, setInvitationPreview] = useState<any | null>(null);
  const [selectedServerForInvite, setSelectedServerForInvite] = useState('');
  const [serverInvites, setServerInvites] = useState<any[] | null>([]);

  function getCurrentUser() {
    try {
      const value = localStorage.getItem('user');
      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function getCurrentUserId() {
    return getCurrentUser()?.id ?? '';
  }

  async function createServer() {
    const ownerId = getCurrentUserId();

    if (!ownerId || !newServerName) {
      setCreateServerStatus('Enter a server name and sign in again if needed.');
      return;
    }

    setIsCreatingServer(true);
    setCreateServerStatus('');

    try {
      const data = await createServerRequest({
        name: newServerName,
        ownerId,
        isPublic: newServerPublic,
      });

      setServers((current) => [...(current ?? []), data]);
      setNewServerName('');
      setNewServerPublic(false);
      setCreateServerStatus('Server created successfully.');
    } catch (error) {
      setCreateServerStatus(
        error instanceof Error ? error.message : 'Unable to create server.',
      );
    } finally {
      setIsCreatingServer(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      fetchServers(),
      fetchChannels(),
      fetchNotifications(),
      fetchIncomingFriendRequests(),
      fetchOutgoingFriendRequests(),
      fetchFriends(),
    ])
      .then(
        ([
          serversData,
          channelsData,
          notificationsData,
          incomingData,
          outgoingData,
          friendsData,
        ]) => {
        setServers(serversData ?? []);
        setChannels(channelsData ?? []);
        setNotifications(notificationsData ?? []);
          setIncomingRequests(incomingData ?? []);
          setOutgoingRequests(outgoingData ?? []);
          setFriends(friendsData ?? []);
        },
      )
      .catch((err) => console.error('Error fetching settings data:', err));
  }, []);

  async function refreshFriendData() {
    const [incomingData, outgoingData, friendsData] = await Promise.all([
      fetchIncomingFriendRequests(),
      fetchOutgoingFriendRequests(),
      fetchFriends(),
    ]);

    setIncomingRequests(incomingData ?? []);
    setOutgoingRequests(outgoingData ?? []);
    setFriends(friendsData ?? []);
  }

  async function markNotificationAsRead(notificationId: string) {
    await markNotificationAsReadRequest(notificationId);

    setNotifications((current) =>
      (current ?? []).map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
  }

  async function changePassword() {
    if (!oldPassword || !newPassword || !newPasswordConfirm) {
      setChangePasswordStatus('Fill in all password fields.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setChangePasswordStatus('New password confirmation does not match.');
      return;
    }

    setIsChangingPassword(true);
    setChangePasswordStatus('');

    try {
      await changePasswordRequest({
        oldPassword,
        newPassword,
        newPasswordConfirm,
      });

      setChangePasswordStatus('Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error) {
      setChangePasswordStatus(
        error instanceof Error ? error.message : 'Unable to change password.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function initiateTfa() {
    try {
      const data = await initiateTfaRequest();

      setTfaUri(data?.uri ?? '');
      setTfaStatus('TFA setup started. Scan the QR URI or copy it.');
    } catch (error) {
      setTfaStatus(
        error instanceof Error ? error.message : 'Unable to initiate TFA.',
      );
    }
  }

  async function verifyTfa(mode: 'enable' | 'disable') {
    if (!tfaToken) {
      setTfaStatus('Enter the 6-digit TFA code.');
      return;
    }

    try {
      await setTfa(mode, tfaToken);

      setTfaStatus(`TFA ${mode}d successfully.`);
      setTfaToken('');
    } catch (error) {
      setTfaStatus(
        error instanceof Error ? error.message : `Unable to ${mode} TFA.`,
      );
    }
  }

  async function leaveServer(serverId: string) {
    const userId = getCurrentUserId();
    if (!userId) {
      setChangePasswordStatus('Missing current user. Sign in again.');
      return;
    }

    try {
      await leaveServerRequest(serverId, userId);

      setServers((current) =>
        (current ?? []).filter((server) => server.id !== serverId),
      );
    } catch (error) {
      setChangePasswordStatus(
        error instanceof Error ? error.message : 'Unable to leave server.',
      );
    }
  }

  async function deleteServer(serverId: string) {
    const userId = getCurrentUserId();
    if (!userId) {
      setChangePasswordStatus('Missing current user. Sign in again.');
      return;
    }

    try {
      await deleteServerRequest(serverId, userId);

      setServers((current) =>
        (current ?? []).filter((server) => server.id !== serverId),
      );
    } catch (error) {
      setChangePasswordStatus(
        error instanceof Error ? error.message : 'Unable to delete server.',
      );
    }
  }

  async function renameServer(serverId: string) {
    const nextName = window.prompt('New server name');
    if (!nextName?.trim()) {
      return;
    }

    try {
      await renameServerRequest(serverId, nextName.trim());

      setServers((current) =>
        (current ?? []).map((server) =>
          server.id === serverId
            ? { ...server, name: nextName.trim() }
            : server,
        ),
      );
    } catch (error) {
      setChangePasswordStatus(
        error instanceof Error ? error.message : 'Unable to update server.',
      );
    }
  }

  async function deleteChannel(channelId: string) {
    try {
      await deleteChannelRequest(channelId);

      setChannels((current) =>
        (current ?? []).filter((channel) => channel.id !== channelId),
      );
    } catch (error) {
      setChangePasswordStatus(
        error instanceof Error ? error.message : 'Unable to delete channel.',
      );
    }
  }

  async function renameChannel(channelId: string) {
    const nextName = window.prompt('New channel name');
    if (!nextName?.trim()) {
      return;
    }

    try {
      await renameChannelRequest(channelId, nextName.trim());

      setChannels((current) =>
        (current ?? []).map((channel) =>
          channel.id === channelId
            ? { ...channel, name: nextName.trim() }
            : channel,
        ),
      );
    } catch (error) {
      setChangePasswordStatus(
        error instanceof Error ? error.message : 'Unable to update channel.',
      );
    }
  }

  async function createChannel() {
    if (!newChannelName || !newChannelServerId) {
      setCreateChannelStatus('Enter a channel name and server id.');
      return;
    }

    setIsCreatingChannel(true);
    setCreateChannelStatus('');

    try {
      const data = await createChannelRequest({
        name: newChannelName,
        serverId: newChannelServerId,
      });

      setChannels((current) => [...(current ?? []), data]);
      setNewChannelName('');
      setCreateChannelStatus('Channel created successfully.');
    } catch (error) {
      setCreateChannelStatus(
        error instanceof Error ? error.message : 'Unable to create channel.',
      );
    } finally {
      setIsCreatingChannel(false);
    }
  }

  async function performFriendSearch() {
    const query = friendSearchQuery.trim();

    if (query.length < 2) {
      setFriendSearchResults([]);
      setFriendStatus('Type at least 2 characters to search users.');
      return;
    }

    try {
      setIsSearchingFriends(true);
      setFriendStatus('');
      const results = await searchUsers(query);
      setFriendSearchResults(results);

      if (!results.length) {
        setFriendStatus('No users found for your search query.');
      }
    } catch (error) {
      setFriendSearchResults([]);
      setFriendStatus(
        error instanceof Error ? error.message : 'Unable to search users.',
      );
    } finally {
      setIsSearchingFriends(false);
    }
  }

  async function submitFriendRequest() {
    if (!selectedFriendUser?.id) {
      setFriendStatus('Select a user from search results first.');
      return;
    }

    try {
      await sendFriendRequest(selectedFriendUser.id);
      setFriendSearchQuery('');
      setFriendSearchResults([]);
      setSelectedFriendUser(null);
      setFriendStatus('Friend request sent.');
      await refreshFriendData();
    } catch (error) {
      setFriendStatus(
        error instanceof Error
          ? error.message
          : 'Unable to send friend request.',
      );
    }
  }

  async function updateFriendRequest(
    requestId: string,
    action: 'accept' | 'reject' | 'cancel',
  ) {
    try {
      if (action === 'accept') {
        await acceptFriendRequest(requestId);
      } else if (action === 'reject') {
        await rejectFriendRequest(requestId);
      } else {
        await cancelFriendRequest(requestId);
      }

      await refreshFriendData();
    } catch (error) {
      setFriendStatus(
        error instanceof Error
          ? error.message
          : `Unable to ${action} this friend request.`,
      );
    }
  }

  async function removeFriend(friendship: any) {
    const userId = getCurrentUserId();
    const targetId =
      friendship?.userId1 === userId ? friendship?.userId2 : friendship?.userId1;

    if (!targetId) {
      setFriendStatus('Unable to determine friend id.');
      return;
    }

    try {
      await unfriend(targetId);
      await refreshFriendData();
    } catch (error) {
      setFriendStatus(
        error instanceof Error ? error.message : 'Unable to remove friend.',
      );
    }
  }

  async function previewInvitation() {
    if (!inviteCode) {
      setInvitationStatus('Enter an invitation code.');
      return;
    }

    try {
      const data = await resolveInvitation(inviteCode);
      setInvitationPreview(data);
      setInvitationStatus('Invitation found. You can accept it now.');
    } catch (error) {
      setInvitationPreview(null);
      setInvitationStatus(
        error instanceof Error ? error.message : 'Unable to resolve invitation.',
      );
    }
  }

  async function acceptInvite() {
    if (!inviteCode) {
      setInvitationStatus('Enter an invitation code first.');
      return;
    }

    try {
      await acceptInvitation(inviteCode);
      setInvitationStatus('Invitation accepted successfully.');
      setInviteCode('');
      setInvitationPreview(null);
      setServers(await fetchServers());
    } catch (error) {
      setInvitationStatus(
        error instanceof Error ? error.message : 'Unable to accept invitation.',
      );
    }
  }

  async function loadServerInvitations() {
    if (!selectedServerForInvite) {
      setInvitationStatus('Select a server id first.');
      return;
    }

    try {
      const data = await fetchServerInvitations(selectedServerForInvite);
      setServerInvites(data ?? []);
    } catch (error) {
      setServerInvites([]);
      setInvitationStatus(
        error instanceof Error
          ? error.message
          : 'Unable to load server invitations.',
      );
    }
  }

  async function createInvitationCode() {
    if (!selectedServerForInvite) {
      setInvitationStatus('Select a server id first.');
      return;
    }

    try {
      await createServerInvitation(selectedServerForInvite, 24);
      setInvitationStatus('Invitation created. Refresh list to view it.');
      await loadServerInvitations();
    } catch (error) {
      setInvitationStatus(
        error instanceof Error
          ? error.message
          : 'Unable to create invitation code.',
      );
    }
  }

  const isAdmin = getCurrentUser()?.appRole === 'admin';

  return (
    <>
      <h1>Settings View</h1>
      {isAdmin ? (
        <p>
          <Link to="/settings/admin">Open Admin Management</Link>
        </p>
      ) : null}

      <h2>Change Password</h2>
      <div style={{ marginBottom: '16px', maxWidth: '420px' }}>
        <input
          type="password"
          placeholder="Current password"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={newPasswordConfirm}
          onChange={(event) => setNewPasswordConfirm(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button onClick={changePassword} disabled={isChangingPassword}>
          Update Password
        </button>
        {changePasswordStatus ? <p>{changePasswordStatus}</p> : null}
      </div>

      <h2>TFA</h2>
      <div style={{ marginBottom: '16px', maxWidth: '420px' }}>
        <button
          onClick={initiateTfa}
          style={{ display: 'block', marginBottom: '8px' }}
        >
          Start TFA Setup
        </button>
        <input
          type="text"
          placeholder="6-digit TFA code"
          value={tfaToken}
          onChange={(event) => setTfaToken(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button
          onClick={() => verifyTfa('enable')}
          style={{ marginRight: '8px' }}
        >
          Enable TFA
        </button>
        <button onClick={() => verifyTfa('disable')}>Disable TFA</button>
        {tfaUri ? <pre>{tfaUri}</pre> : null}
        {tfaStatus ? <p>{tfaStatus}</p> : null}
      </div>

      <h2>Servers</h2>
      <div style={{ marginBottom: '16px', maxWidth: '420px' }}>
        <input
          type="text"
          placeholder="Server name"
          value={newServerName}
          onChange={(event) => setNewServerName(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <label style={{ display: 'block', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={newServerPublic}
            onChange={(event) => setNewServerPublic(event.target.checked)}
          />{' '}
          Public server
        </label>
        <button onClick={createServer} disabled={isCreatingServer}>
          Create Server
        </button>
        {createServerStatus ? <p>{createServerStatus}</p> : null}
      </div>

      <div style={{ marginBottom: '16px' }}>
        {(servers ?? []).length ? (
          (servers ?? []).map((server) => (
            <div
              key={server.id}
              style={{
                marginBottom: '12px',
                padding: '12px',
                border: '1px solid #444',
                borderRadius: '8px',
              }}
            >
              <div>{server.name ?? server.id}</div>
              <button onClick={() => renameServer(server.id)}>
                Rename Server
              </button>
              <button onClick={() => leaveServer(server.id)}>
                Leave Server
              </button>
              {server.ownerId === getCurrentUserId() ? (
                <button onClick={() => deleteServer(server.id)}>
                  Delete Server
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <pre>{JSON.stringify(servers, null, 2)}</pre>
        )}
      </div>

      <h2>Channels</h2>
      <div style={{ marginBottom: '16px', maxWidth: '420px' }}>
        <input
          type="text"
          placeholder="Channel name"
          value={newChannelName}
          onChange={(event) => setNewChannelName(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input
          type="text"
          placeholder="Server id"
          value={newChannelServerId}
          onChange={(event) => setNewChannelServerId(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button onClick={createChannel} disabled={isCreatingChannel}>
          Create Channel
        </button>
        {createChannelStatus ? <p>{createChannelStatus}</p> : null}
      </div>

      <div style={{ marginBottom: '16px' }}>
        {(channels ?? []).length ? (
          (channels ?? []).map((channel) => (
            <div
              key={channel.id}
              style={{
                marginBottom: '12px',
                padding: '12px',
                border: '1px solid #444',
                borderRadius: '8px',
              }}
            >
              <div>{channel.name ?? channel.id}</div>
              <button onClick={() => renameChannel(channel.id)}>
                Rename Channel
              </button>
              <button onClick={() => deleteChannel(channel.id)}>
                Delete Channel
              </button>
            </div>
          ))
        ) : (
          <pre>{JSON.stringify(channels, null, 2)}</pre>
        )}
      </div>

      <h2>Notifications</h2>
      <div>
        {(notifications ?? []).length ? (
          (notifications ?? []).map((notification) => (
            <div
              key={notification.id}
              style={{
                marginBottom: '12px',
                padding: '12px',
                border: '1px solid #444',
                borderRadius: '8px',
              }}
            >
              <div>{notification.content}</div>
              <div style={{ opacity: 0.7, fontSize: '12px' }}>
                {notification.type}{' '}
                {notification.isRead ? '(read)' : '(unread)'}
              </div>
              {!notification.isRead && (
                <button onClick={() => markNotificationAsRead(notification.id)}>
                  Mark read
                </button>
              )}
            </div>
          ))
        ) : (
          <pre>{JSON.stringify(notifications, null, 2)}</pre>
        )}
      </div>

      <h2>Friends</h2>
      <div style={{ marginBottom: '16px', maxWidth: '520px' }}>
        <input
          type="text"
          placeholder="Search by username, name, or email"
          value={friendSearchQuery}
          onChange={(event) => setFriendSearchQuery(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button
          onClick={performFriendSearch}
          disabled={isSearchingFriends}
          style={{ marginRight: '8px' }}
        >
          {isSearchingFriends ? 'Searching...' : 'Search Users'}
        </button>
        <button onClick={submitFriendRequest} disabled={!selectedFriendUser}>
          Send Friend Request
        </button>

        {selectedFriendUser ? (
          <p style={{ marginTop: '8px' }}>
            Selected: {selectedFriendUser.firstName} {selectedFriendUser.lastName}{' '}
            ({selectedFriendUser.username || selectedFriendUser.email || selectedFriendUser.id})
          </p>
        ) : null}

        {(friendSearchResults ?? []).length ? (
          <div style={{ marginTop: '10px', border: '1px solid #444', borderRadius: '8px' }}>
            {friendSearchResults.map((user) => (
              <div
                key={user.id}
                style={{
                  padding: '10px',
                  borderBottom: '1px solid #333',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div>
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') ||
                      user.username ||
                      'Unknown user'}
                  </div>
                  <div style={{ opacity: 0.75, fontSize: '12px' }}>
                    {user.username ? `@${user.username}` : ''}{' '}
                    {user.email ? `- ${user.email}` : ''}
                  </div>
                </div>
                <button onClick={() => setSelectedFriendUser(user)}>Select</button>
              </div>
            ))}
          </div>
        ) : null}

        {friendStatus ? <p>{friendStatus}</p> : null}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h3>Incoming Requests</h3>
        {(incomingRequests ?? []).map((request) => (
          <div key={request.id} style={{ marginBottom: '8px' }}>
            <span>{request.senderId}</span>
            <button onClick={() => updateFriendRequest(request.id, 'accept')}>
              Accept
            </button>
            <button onClick={() => updateFriendRequest(request.id, 'reject')}>
              Reject
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h3>Outgoing Requests</h3>
        {(outgoingRequests ?? []).map((request) => (
          <div key={request.id} style={{ marginBottom: '8px' }}>
            <span>{request.receiverId}</span>
            <button onClick={() => updateFriendRequest(request.id, 'cancel')}>
              Cancel
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h3>Friends</h3>
        {(friends ?? []).map((friendship) => {
          const userId = getCurrentUserId();
          const friendId =
            friendship.userId1 === userId ? friendship.userId2 : friendship.userId1;

          return (
            <div key={`${friendship.userId1}:${friendship.userId2}`}>
              <span>{friendId}</span>
              <button onClick={() => removeFriend(friendship)}>Unfriend</button>
            </div>
          );
        })}
      </div>

      <h2>Invitations</h2>
      <div style={{ marginBottom: '16px', maxWidth: '420px' }}>
        <input
          type="text"
          placeholder="Invite code"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button onClick={previewInvitation} style={{ marginRight: '8px' }}>
          Resolve
        </button>
        <button onClick={acceptInvite}>Accept</button>
        {invitationPreview ? (
          <pre style={{ marginTop: '8px' }}>
            {JSON.stringify(invitationPreview, null, 2)}
          </pre>
        ) : null}
      </div>

      <div style={{ marginBottom: '16px', maxWidth: '420px' }}>
        <input
          type="text"
          placeholder="Server id"
          value={selectedServerForInvite}
          onChange={(event) => setSelectedServerForInvite(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px', color: 'black', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button onClick={createInvitationCode} style={{ marginRight: '8px' }}>
          Create Invitation
        </button>
        <button onClick={loadServerInvitations}>List Invitations</button>
        {(serverInvites ?? []).length ? (
          <pre style={{ marginTop: '8px' }}>
            {JSON.stringify(serverInvites, null, 2)}
          </pre>
        ) : null}
      </div>

      {invitationStatus ? <p>{invitationStatus}</p> : null}
    </>
  );
}

export default SettingsView;
