// Lightweight shim to adapt original Supabase calls to the local backend API.
// It provides the small subset of the Supabase API that the frontend uses
// (`supabase.auth.user()`, `supabase.auth.signOut()`, and `supabase.from(...).insert/then`).

import { io, Socket } from 'socket.io-client';
import { API_URL, normalizeBlobUrl } from './services/api.service';

type StoredUser = {
  id?: string;
  email?: string;
  name?: string;
  avatar?: string | null;
};

type InsertRow = Record<string, any>;

type ChannelRecord = {
  id?: string;
  serverId?: string | null;
  type?: string;
};

type RealtimeHandler = (payload: any) => void;

let chatSocket: Socket | null = null;
let notificationsSocket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function getStoredToken(): string | null {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      return accessToken;
    }

    const legacyToken = localStorage.getItem('token');
    if (legacyToken) {
      localStorage.setItem('access_token', legacyToken);
      localStorage.removeItem('token');
      return legacyToken;
    }

    return null;
  } catch {
    return null;
  }
}

function getStoredUser(): StoredUser | null {
  try {
    const value = localStorage.getItem('user');
    return value ? (JSON.parse(value) as StoredUser) : null;
  } catch {
    return null;
  }
}

function buildDisplayUser(userId?: string | null): StoredUser | null {
  const storedUser = getStoredUser();
  if (storedUser?.id && userId && storedUser.id === userId) {
    return storedUser;
  }

  if (!userId) {
    return storedUser;
  }

  return {
    id: userId,
    name: `User ${userId.slice(0, 8)}`,
    email: '',
    avatar: null,
  };
}

function getChannelIdFromTable(table: string, filters: Map<string, any>) {
  if (filters.has('channel_id')) {
    return String(filters.get('channel_id'));
  }

  if (table.startsWith('messages:')) {
    const match = table.match(/channel_id=eq\.([a-f0-9-]+)/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function startHeartbeat(socket: Socket) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('presence:heartbeat');
    }
  }, 30000); // 30 seconds
}

function normalizeRealtimeMessage(record: Record<string, any>) {
  return normalizeMessage({
    id: record.id,
    channelId: record.channelId ?? record.channel_id,
    content: record.content ?? record.text,
    authorId: record.authorId ?? record.sent_by,
    createdAt: record.createdAt ?? record.created_at,
  });
}

export function getChatSocket() {
  const accessToken = getStoredToken();
  if (!accessToken) {
    return null;
  }

  if (chatSocket && chatSocket.connected) {
    const currentToken = (chatSocket.auth as { token?: string } | undefined)
      ?.token;
    if (currentToken === accessToken) {
      return chatSocket;
    }
  }

  if (chatSocket) {
    chatSocket.disconnect();
  }

  chatSocket = io(`${API_URL}/chat`, {
    autoConnect: true,
    transports: ['websocket'],
    withCredentials: true,
    auth: { token: accessToken },
  });

  startHeartbeat(chatSocket);

  return chatSocket;
}

export function getNotificationsSocket() {
  const accessToken = getStoredToken();
  if (!accessToken) {
    return null;
  }

  if (notificationsSocket && notificationsSocket.connected) {
    const currentToken = (
      notificationsSocket.auth as { token?: string } | undefined
    )?.token;
    if (currentToken === accessToken) {
      return notificationsSocket;
    }
  }

  if (notificationsSocket) {
    notificationsSocket.disconnect();
  }

  notificationsSocket = io(`${API_URL}/notifications`, {
    autoConnect: true,
    transports: ['websocket'],
    withCredentials: true,
    auth: { token: accessToken },
  });

  return notificationsSocket;
}

function buildHeaders(extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const accessToken = getStoredToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function handleJsonResponse(res: Response) {
  if (!res.ok) {
    return res.json().catch(() => ({ error: res.statusText }));
  }
  return res.json().catch(() => ({}));
}

function normalizeDate(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

function normalizeMessage(record: Record<string, any>) {
  const sentBy = record.sent_by ?? record.authorId ?? record.author_id ?? null;
  const displayUser = record.app_users ?? buildDisplayUser(sentBy);

  return {
    id: record.id,
    channel_id: record.channel_id ?? record.channelId,
    text: record.text ?? record.content ?? '',
    sent_by: sentBy,
    app_users: displayUser,
    created_at: normalizeDate(record.created_at ?? record.createdAt),
    updated_at: normalizeDate(record.updated_at ?? record.updatedAt),
    deleted_at: record.deleted_at ?? record.deletedAt ?? null,
    attachments: Array.isArray(record.attachments)
      ? record.attachments.map((attachment: Record<string, any>) => ({
          ...attachment,
          url: normalizeBlobUrl(attachment.url),
        }))
      : [],
  };
}

function extractCollection(payload: any): Array<Record<string, any>> {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

class QueryBuilder {
  private table: string;
  private filters: Map<string, any> = new Map();
  private selectFields: string = '*';
  private isSingle = false;
  private insertValues: InsertRow[] | null = null;
  private limitValue: number | null = null;
  private orderField: string | null = null;
  private orderAscending = true;
  private realtimeHandler: RealtimeHandler | null = null;
  private realtimeSubscribed = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.set(column, value);
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  insert(values: InsertRow | InsertRow[]) {
    this.insertValues = Array.isArray(values) ? values : [values];
    return this;
  }

  on(event: string, callback: Function) {
    this.realtimeHandler = callback as RealtimeHandler;
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  subscribe() {
    void this.startRealtimeSubscription();
    return this;
  }

  private async startRealtimeSubscription() {
    if (this.realtimeSubscribed || !this.realtimeHandler) {
      return;
    }

    const channelId = getChannelIdFromTable(this.table, this.filters);
    if (!channelId) {
      return;
    }

    const socket = getChatSocket();
    if (!socket) {
      console.warn(
        `Real-time subscription for ${this.table} skipped because no JWT token was found`,
      );
      return;
    }

    const channel = await this.fetchChannel(channelId);
    if (channel?.serverId) {
      socket.emit('server:join', channel.serverId);
      socket.emit('channel:join', {
        serverId: channel.serverId,
        channelId,
      });
    } else {
      socket.emit('dm:join', { channelId });
    }

    const emitInsert = (payload: Record<string, any>) => {
      if (payload.channelId !== channelId && payload.channel_id !== channelId) {
        return;
      }

      this.realtimeHandler?.({
        eventType: 'INSERT',
        new: normalizeRealtimeMessage(payload),
        old: null,
      });
    };

    const emitUpdate = (payload: Record<string, any>) => {
      if (payload.channelId !== channelId && payload.channel_id !== channelId) {
        return;
      }

      this.realtimeHandler?.({
        eventType: 'UPDATE',
        new: normalizeRealtimeMessage(payload),
        old: null,
      });
    };

    const emitDelete = (payload: Record<string, any>) => {
      if (payload.channelId !== channelId && payload.channel_id !== channelId) {
        return;
      }

      this.realtimeHandler?.({
        eventType: 'DELETE',
        old: normalizeRealtimeMessage(payload),
        new: null,
      });
    };

    socket.off('message:created', emitInsert);
    socket.off('message:updated', emitUpdate);
    socket.off('message:deleted', emitDelete);

    socket.on('message:created', emitInsert);
    socket.on('message:updated', emitUpdate);
    socket.on('message:deleted', emitDelete);

    this.realtimeSubscribed = true;
  }

  private async fetchChannel(channelId: string): Promise<ChannelRecord | null> {
    try {
      const res = await fetch(`${API_URL}/channels/${channelId}`, {
        headers: buildHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        return null;
      }

      return (await handleJsonResponse(res)) as ChannelRecord;
    } catch {
      return null;
    }
  }

  private buildUrl(): string {
    let url = `${API_URL}/${this.table}`;

    if (this.table.includes('messages')) {
      if (this.filters.has('channel_id')) {
        const channelId = this.filters.get('channel_id');
        url = `${API_URL}/messages/channel/${channelId}`;
        this.filters.delete('channel_id');
      } else if (this.table.startsWith('messages:')) {
        const match = this.table.match(/channel_id=eq\.([a-f0-9-]+)/);
        if (match && match[1]) {
          url = `${API_URL}/messages/channel/${match[1]}`;
        }
      }
    } else if (this.table === 'channels' && this.filters.has('id')) {
      const id = this.filters.get('id');
      url = `${API_URL}/channels/${id}`;
      this.filters.delete('id');
    }

    if (this.limitValue !== null) {
      this.filters.set('limit', String(this.limitValue));
    }

    if (this.orderField) {
      this.filters.set('order', this.orderField);
      this.filters.set('ascending', String(this.orderAscending));
    }

    const params = new URLSearchParams();
    for (const [key, value] of this.filters) {
      params.append(key, value);
    }

    const queryStr = params.toString() ? `?${params}` : '';
    return url + queryStr;
  }

  private async performInsert(callback: Function) {
    const row = this.insertValues?.[0] ?? {};
    const token = getStoredToken();
    const guestUserId = row.sent_by ?? getStoredUser()?.id;
    const isAuthenticated = Boolean(token);
    const url = isAuthenticated
      ? `${API_URL}/messages`
      : `${API_URL}/messages/guest`;

    const payload = {
      channelId: row.channel_id ?? row.channelId,
      content: row.content ?? row.text ?? row.message ?? '',
      parentMessageId: row.parentMessageId ?? row.parent_message_id,
      threadRootMessageId:
        row.threadRootMessageId ?? row.thread_root_message_id,
      mentions: row.mentions,
      attachments: row.attachments,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(
          guestUserId ? { 'x-guest-user-id': String(guestUserId) } : {},
        ),
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await handleJsonResponse(res);
      const normalized = normalizeMessage(
        Array.isArray(data) ? (data[0] ?? {}) : data,
      );

      return callback({ data: [normalized], error: null });
    } catch (error) {
      return callback({ data: null, error });
    }
  }

  async then(callback: Function) {
    if (this.insertValues) {
      return this.performInsert(callback);
    }

    if (this.table === 'app_users' && this.filters.has('id')) {
      const id = this.filters.get('id');
      const user = buildDisplayUser(id);
      return callback({ data: user, error: null });
    }

    const url = this.buildUrl();

    try {
      const res = await fetch(url, {
        headers: buildHeaders(),
        credentials: 'include',
      });

      const data = await handleJsonResponse(res);
      const collection = extractCollection(data);

      if (url.includes('/messages/channel/')) {
        const normalized = collection.map((item) => normalizeMessage(item));

        if (this.isSingle) {
          return callback({ data: normalized[0] || null, error: null });
        }

        return callback({ data: normalized, error: null });
      }

      if (url.includes('/channels/')) {
        if (this.isSingle) {
          return callback({ data, error: null });
        }

        return callback({
          data: collection.length ? collection[0] : data,
          error: null,
        });
      }

      if (this.isSingle && Array.isArray(data)) {
        return callback({ data: data[0] || null, error: null });
      }

      return callback({ data, error: null });
    } catch (error) {
      return callback({ data: null, error });
    }
  }
}
export const supabase = {
  auth: {
    // Returns cached user if available (keeps useAuth sync). Real login flows
    // should store `user` and `access_token` in localStorage when implemented.
    user(): any | null {
      try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
      } catch (e) {
        return null;
      }
    },

    async signOut() {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e) {
        // ignore network errors on sign out
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },

    async refresh() {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json().catch(() => ({}));

        if (data?.access_token) {
          localStorage.setItem('access_token', data.access_token);
          localStorage.removeItem('token');
        }

        return data;
      } catch {
        return null;
      }
    },
  },

  from<T = any>(table: string) {
    return new QueryBuilder(table) as any;
  },
};
