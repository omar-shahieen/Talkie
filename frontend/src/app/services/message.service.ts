import { Message } from '../datamodels';
import { getAccessToken } from './auth.service';
import { buildAuthHeaders, normalizeBlobUrl, requestJson } from './api.service';

export type MessageAttachmentInput = {
  url: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type SendMessageInput = {
  channelId: string;
  content: string;
  parentMessageId?: string | null;
  threadRootMessageId?: string | null;
  attachments?: MessageAttachmentInput[];
  guestUserId?: string | null;
};

type ApiMessage = Record<string, any>;

function normalizeAttachment(attachment: Record<string, any>) {
  return {
    ...attachment,
    url: normalizeBlobUrl(attachment.url),
    created_at:
      attachment.created_at ?? attachment.createdAt ?? new Date().toISOString(),
    updated_at:
      attachment.updated_at ?? attachment.updatedAt ?? new Date().toISOString(),
  };
}

export function normalizeMessage(record: ApiMessage): Message {
  const authorId =
    record.sent_by ??
    record.senderId ??
    record.authorId ??
    record.author_id ??
    null;

  return {
    id: record.id,
    channel_id: record.channel_id ?? record.channelId,
    text: record.text ?? record.content ?? '',
    sent_by: authorId,
    app_users: record.app_users ?? record.user ?? null,
    created_at:
      record.created_at ?? record.createdAt ?? new Date().toISOString(),
    updated_at:
      record.updated_at ?? record.updatedAt ?? new Date().toISOString(),
    deleted_at: record.deleted_at ?? record.deletedAt ?? null,
    parentMessageId: record.parentMessageId ?? record.parent_message_id ?? null,
    threadRootMessageId:
      record.threadRootMessageId ?? record.thread_root_message_id ?? null,
    reactions: Array.isArray(record.reactions) ? record.reactions : [],
    attachments: Array.isArray(record.attachments)
      ? record.attachments.map(normalizeAttachment)
      : [],
  };
}

function normalizeMessageCollection(payload: unknown): Message[] {
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] } | null)?.data)
      ? ((payload as { data?: unknown[] }).data ?? [])
      : Array.isArray((payload as { items?: unknown[] } | null)?.items)
        ? ((payload as { items?: unknown[] }).items ?? [])
        : [];

  return records.map((record) => normalizeMessage(record as ApiMessage));
}

export async function fetchMessages(channelId: string) {
  const data = await requestJson<unknown>(`/messages/channel/${channelId}`);
  return normalizeMessageCollection(data);
}

export async function fetchThreadMessages(messageId: string) {
  const data = await requestJson<unknown>(`/messages/${messageId}/thread`);
  return normalizeMessageCollection(data);
}

export async function getChannel(channelId: string) {
  return requestJson<Record<string, any>>(`/channels/${channelId}`);
}

export async function toggleMessageReaction(
  messageId: string,
  emoji: string,
  hasReaction: boolean,
) {
  return requestJson(`/messages/${messageId}/reactions`, {
    method: hasReaction ? 'DELETE' : 'POST',
    body: { emoji },
  });
}

export async function deleteMessage(messageId: string) {
  return requestJson(`/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export async function editMessage(messageId: string, text: string) {
  return requestJson(`/messages/${messageId}`, {
    method: 'PATCH',
    body: { text },
  });
}

export async function sendMessage(input: SendMessageInput) {
  const token = getAccessToken();
  const isAuthenticated = Boolean(token);
  const endpoint = isAuthenticated ? '/messages' : '/messages/guest';

  const payload = {
    channelId: input.channelId,
    content: input.content,
    parentMessageId: input.parentMessageId,
    threadRootMessageId: input.threadRootMessageId,
    attachments: input.attachments,
  };

  const headers = input.guestUserId
    ? buildAuthHeaders({ 'x-guest-user-id': String(input.guestUserId) })
    : buildAuthHeaders();

  const data = await requestJson<unknown>(endpoint, {
    method: 'POST',
    headers,
    body: payload,
    token,
  });

  const normalized = normalizeMessage(
    Array.isArray(data) ? (data[0] as ApiMessage) || {} : (data as ApiMessage),
  );

  return normalized;
}

export async function uploadMessageFiles(channelId: string, files: File[]) {
  const formData = new FormData();
  formData.append('channelId', channelId);

  files.forEach((file) => {
    formData.append('files', file);
  });

  const data = await requestJson<unknown>('/messages/upload', {
    method: 'POST',
    body: formData,
  });

  const attachments = (
    Array.isArray((data as { attachments?: unknown[] } | null)?.attachments)
      ? ((data as { attachments?: unknown[] }).attachments ?? [])
      : []
  ) as Record<string, any>[];

  return attachments.map(normalizeAttachment);
}

export async function searchMessages(input: {
  keyword: string;
  serverId?: string;
  channelId?: string;
  limit?: number;
}) {
  return requestJson<{ items?: ApiMessage[]; total?: number }>(
    '/messages/search/query',
    {
      query: {
        keyword: input.keyword,
        serverId: input.serverId,
        channelId: input.channelId,
        limit: input.limit ?? 10,
      },
    },
  );
}
