import { requestJson } from './api.service';

type ServerPayload = {
  id: string;
  name?: string;
  ownerId?: string;
  isPublic?: boolean;
};

export async function fetchServers(): Promise<ServerPayload[]> {
  const data = await requestJson<unknown>('/servers');
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
