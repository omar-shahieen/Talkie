import { getAccessToken } from '../app/authStorage';
import { fetchVisibleChannelsByServer } from '../app/services/channel.service';
import { fetchMyServers, fetchServers } from '../app/services/server.service';

export const DEFAULT_CHANNEL_ID = '4caf111f-ed31-4e81-8735-f92d5860c878';
export const DEFAULT_SERVER_ID = 'a246a23f-c43b-446d-a1ba-7219c53b94c6';
export const DEFAULT_REDIRECT_ROUTE = `/servers/${DEFAULT_SERVER_ID}/channels/${DEFAULT_CHANNEL_ID}`;
export const OTHER_REDIRECT_ROUTE = `/servers/98382d04-9d6d-4b98-9dd8-9c980a4e5b0c/channels/cd9d9bbb-4202-4aa1-88ec-21c17d809301`;

function decodeJwtPayload(token: string): { sub?: string } | null {
  const payloadPart = token.split('.')[1];
  if (!payloadPart) {
    return null;
  }

  const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getStoredUserId(): string {
  try {
    const value = localStorage.getItem('user');
    if (value) {
      const user = JSON.parse(value);
      if (user?.id) {
        return user.id;
      }
    }
  } catch {
    // fall through to token decoding
  }

  const token = getAccessToken();
  return token ? decodeJwtPayload(token)?.sub ?? '' : '';
}

export async function resolveDefaultRedirectRoute(): Promise<string> {
  if (!getAccessToken()) {
    return '/login';
  }

  const userId = getStoredUserId();

  if (!userId) {
    return DEFAULT_REDIRECT_ROUTE;
  }

  try {
    const servers = await fetchMyServers(userId);
    const serverFallback = servers.length ? servers : await fetchServers();

    for (const server of serverFallback) {
      if (!server?.id) {
        continue;
      }

      const channels = await fetchVisibleChannelsByServer(server.id, userId);
      const firstChannel = channels[0];

      if (firstChannel?.id) {
        return `/servers/${server.id}/channels/${firstChannel.id}`;
      }
    }
  } catch {
    // Keep the existing seeded route as a final fallback.
  }

  return DEFAULT_REDIRECT_ROUTE;
}
