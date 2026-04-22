export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface ChannelRoomPayload {
  serverId: string;
  channelId: string;
}

export interface TypingPayload extends ChannelRoomPayload {
  isTyping?: boolean;
}

export interface PresencePayload {
  status: PresenceStatus;
  dnd_until?: Date;
}

export interface MessageCreatedPayload {
  id: string;
  channelId: string;
  content: string;
  authorId: string;
  createdAt: Date;

  // These might be explicitly added by your MessageService before emitting
  serverId?: string; // Will exist if it's a Server channel
  senderId?: string; // Used for DMs
  recipientId?: string; // Used for DMs
}
