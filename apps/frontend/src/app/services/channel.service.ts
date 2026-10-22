import { requestJson } from './api.service';

type ChannelPayload = {
  id: string;
  name?: string;
  serverId?: string;
};

export async function fetchChannels(): Promise<ChannelPayload[]> {
  const data = await requestJson<unknown>('/channels');
  return Array.isArray(data) ? (data as ChannelPayload[]) : [];
}

export async function fetchVisibleChannelsByServer(
  serverId: string,
  userId: string,
): Promise<ChannelPayload[]> {
  const data = await requestJson<unknown>(
    `/channels/server/${serverId}/visible/${userId}`,
  );

  return Array.isArray(data) ? (data as ChannelPayload[]) : [];
}

export async function createChannel(payload: {
  name: string;
  serverId: string;
}): Promise<ChannelPayload> {
  return requestJson<ChannelPayload>('/channels', {
    method: 'POST',
    body: payload,
  });
}

export async function deleteChannel(channelId: string): Promise<unknown> {
  return requestJson(`/channels/${channelId}`, {
    method: 'DELETE',
  });
}

export async function renameChannel(
  channelId: string,
  name: string,
): Promise<ChannelPayload> {
  return requestJson<ChannelPayload>(`/channels/${channelId}`, {
    method: 'PATCH',
    body: { name },
  });
}

export async function acknowledgeChannel(
  channelId: string,
  messageId: string,
): Promise<unknown> {
  return requestJson(`/channels/${channelId}/ack`, {
    method: 'POST',
    body: { messageId },
  });
}
