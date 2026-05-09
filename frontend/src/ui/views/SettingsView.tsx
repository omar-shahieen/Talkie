import React, { useEffect, useState } from 'react';
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
  createServer as createServerRequest,
  deleteServer as deleteServerRequest,
  fetchServers,
  leaveServer as leaveServerRequest,
  renameServer as renameServerRequest,
} from '../../app/services/server.service';

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

  function getCurrentUserId() {
    try {
      const value = localStorage.getItem('user');
      if (!value) {
        return '';
      }

      const user = JSON.parse(value);
      return user?.id ?? '';
    } catch {
      return '';
    }
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
    void Promise.all([fetchServers(), fetchChannels(), fetchNotifications()])
      .then(([serversData, channelsData, notificationsData]) => {
        setServers(serversData ?? []);
        setChannels(channelsData ?? []);
        setNotifications(notificationsData ?? []);
      })
      .catch((err) => console.error('Error fetching settings data:', err));
  }, []);

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

  return (
    <>
      <h1>Settings View</h1>

      <h2>Change Password</h2>
      <div style={{ marginBottom: '16px', maxWidth: '420px' }}>
        <input
          type="password"
          placeholder="Current password"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px' }}
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px' }}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={newPasswordConfirm}
          onChange={(event) => setNewPasswordConfirm(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px' }}
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
          style={{ display: 'block', width: '100%', marginBottom: '8px' }}
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
          style={{ display: 'block', width: '100%', marginBottom: '8px' }}
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
          style={{ display: 'block', width: '100%', marginBottom: '8px' }}
        />
        <input
          type="text"
          placeholder="Server id"
          value={newChannelServerId}
          onChange={(event) => setNewChannelServerId(event.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '8px' }}
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
    </>
  );
}

export default SettingsView;
