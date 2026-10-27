export type MessageSendDto =
  | {
      type: 'mention';
      serverId: string;
      senderId: string;
      channelName: string;
      channelId: string;
      mentions: string[];
    }
  | {
      type: 'DM';
      senderId: string;
      recepientId: string;
      isDirectMessage: boolean;
    };
