import { requestJson } from './api.service';

type ServerPayload = {
  id: string;
  name?: string;
  ownerId?: string;
  isPublic?: boolean;
};

type ServerInvitationPayload = {
  inviteCode: string;
  serverId?: string;
  createdAt?: string;
  expiresAt?: string | null;
};

export async function fetchServers(): Promise<ServerPayload[]> {
  const data = await requestJson<unknown>('/servers');
  return Array.isArray(data) ? (data as ServerPayload[]) : [];
}

export async function fetchMyServers(userId: string): Promise<ServerPayload[]> {
  const data = await requestJson<unknown>(`/servers/mine/${userId}`);
  return Array.isArray(data) ? (data as ServerPayload[]) : [];
}

export async function discoverPublicServers(input: {
  query?: string;
  page?: number;
  limit?: number;
}): Promise<ServerPayload[]> {
  const data = await requestJson<unknown>('/servers/discovery/public', {
    query: {
      q: input.query,
    },
  });

  return Array.isArray(data) ? (data as ServerPayload[]) : [];
}

export async function createServer(payload: {
  name: string;
  ownerId: string;
  isPublic: boolean;
}): Promise<ServerPayload> {
  return requestJson<ServerPayload>('/servers', {
    method: 'POST',
    body: payload,
  });
}

export async function leaveServer(
  serverId: string,
  userId: string,
): Promise<unknown> {
  return requestJson(`/servers/${serverId}/leave/${userId}`, {
    method: 'DELETE',
  });
}

export async function deleteServer(
  serverId: string,
  requesterId: string,
): Promise<unknown> {
  return requestJson(`/servers/${serverId}`, {
    method: 'DELETE',
    query: { requesterId },
  });
}

export async function renameServer(
  serverId: string,
  name: string,
): Promise<ServerPayload> {
  return requestJson<ServerPayload>(`/servers/${serverId}`, {
    method: 'PATCH',
    body: { name },
  });
}

export async function createServerInvitation(
  serverId: string,
  expiresInHours?: number,
): Promise<ServerInvitationPayload | string> {
  return requestJson<ServerInvitationPayload | string>(`/servers/${serverId}/invitation`, {
    method: 'POST',
    body: {
      expiresInHours,
    },
  });
}

export async function fetchServerInvitations(
  serverId: string,
): Promise<ServerInvitationPayload[]> {
  const data = await requestJson<unknown>(`/servers/${serverId}/invitation`);
  return Array.isArray(data) ? (data as ServerInvitationPayload[]) : [];
}
