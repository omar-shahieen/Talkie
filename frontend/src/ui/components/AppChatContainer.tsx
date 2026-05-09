import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Center, Link, Text } from '@chakra-ui/layout';
import { useDisclosure } from '@chakra-ui/hooks';
import AppChatInput from './AppChatInput';
import AppThreadPanel from './AppThreadPanel';
import { colors } from '../theme/colors';
import { getChatSocket, getNotificationsSocket } from '../../app/supabase';
import { Message } from '../../app/datamodels';
import { Avatar } from '@chakra-ui/avatar';
import { useToast } from '@chakra-ui/toast';
import { Spinner } from '@chakra-ui/spinner';
import { useAuth } from '../../hooks/useAuth';
import {
  deleteMessage as deleteChatMessage,
  editMessage as editChatMessage,
  fetchMessages as fetchChannelMessages,
  getChannel,
  normalizeMessage,
  toggleMessageReaction as toggleChatReaction,
} from '../../app/services/message.service';
import { canDeleteMessage, canEditMessage } from '../../app/access-control';
import { normalizeBlobUrl } from '../../app/services/api.service';
import { useSocketEvent } from '../../hooks/useSocketEvent';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉'];

export type AppChatContainerProps = {
  serverId: string;
  channelId: string;
};

export default function AppChatContainer({
  serverId,
  channelId,
}: AppChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [typingLabel, setTypingLabel] = useState<string>('');
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [threadRoot, setThreadRoot] = useState<Message | null>(null);
  const {
    isOpen: isThreadOpen,
    onOpen: onThreadOpen,
    onClose: onThreadClose,
  } = useDisclosure();
  const currentUser = useAuth();
  const toast = useToast();
  const bottom = useRef<HTMLDivElement | null>(null);
  const userNamesRef = useRef<Record<string, string>>({});
  const hasMessages = messages.length > 0;

  useEffect(() => {
    userNamesRef.current = userNames;
  }, [userNames]);

  async function toggleReaction(messageId: string, emoji: string) {
    const currentMessage = messages.find((message) => message.id === messageId);
    const hasReaction = (currentMessage?.reactions ?? []).some(
      (reaction) =>
        reaction.emoji === emoji && reaction.userId === currentUser?.id,
    );

    try {
      await toggleChatReaction(messageId, emoji, hasReaction);
    } catch (error) {
      console.error('Failed to update reaction', error);
    }
  }

  const notifyNewMessage = useCallback(
    (payload: any) => {
      toast({
        title: 'New message',
        description: payload?.text,
        status: 'info',
        duration: 1000,
        position: 'top',
        isClosable: true,
      });
    },
    [toast],
  );

  const fetchMessages = useCallback(async () => {
    setLoading(true);

    try {
      const data = await fetchChannelMessages(channelId);

      const nameCache: Record<string, string> = {};
      data.forEach((msg: any) => {
        if (msg.user?.id && msg.user?.name) {
          nameCache[msg.user.id] = msg.user.name;
        }
      });
      setUserNames(nameCache);

      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  const scrollToBottom = useCallback(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useSocketEvent<any>(
    getChatSocket,
    'typing:start',
    (payload) => {
      const payloadChannelId = payload?.channelId ?? payload?.channel_id;
      if (payloadChannelId && payloadChannelId !== channelId) {
        return;
      }

      const userId = payload?.userId;
      if (!userId) {
        return;
      }

      const userName =
        userNamesRef.current[userId] ||
        `User ${String(userId).substring(0, 8)}`;
      setTypingLabel(`${userName} is typing...`);
    },
    [channelId],
  );

  useSocketEvent<any>(
    getChatSocket,
    'typing:stop',
    (payload) => {
      const payloadChannelId = payload?.channelId ?? payload?.channel_id;
      if (payloadChannelId && payloadChannelId !== channelId) {
        return;
      }

      setTypingLabel('');
    },
    [channelId],
  );

  useSocketEvent<any>(
    getChatSocket,
    'message:created',
    (payload) => {
      const payloadChannelId = payload?.channelId ?? payload?.channel_id;
      if (payloadChannelId && payloadChannelId !== channelId) {
        return;
      }

      const newMessage = normalizeMessage(payload);

      if (payload?.user?.id && payload?.user?.name) {
        setUserNames((prev) => ({
          ...prev,
          [payload.user.id]: payload.user.name,
        }));
      }

      notifyNewMessage(payload);
      setMessages((old) => {
        if (old.some((item) => item.id === newMessage.id)) {
          return old.map((item) =>
            item.id === newMessage.id ? newMessage : item,
          );
        }

        return [newMessage, ...old];
      });
    },
    [channelId, notifyNewMessage],
  );

  useSocketEvent<any>(
    getChatSocket,
    'message:updated',
    (payload) => {
      const payloadChannelId = payload?.channelId ?? payload?.channel_id;
      if (payloadChannelId && payloadChannelId !== channelId) {
        return;
      }

      setMessages((old) =>
        old.map((item) =>
          item.id === payload.id
            ? {
                ...item,
                ...normalizeMessage({
                  ...item,
                  ...payload,
                  created_at: item.created_at,
                }),
              }
            : item,
        ),
      );
    },
    [channelId],
  );

  useSocketEvent<any>(
    getChatSocket,
    'message:deleted',
    (payload) => {
      setMessages((old) => old.filter((item) => item.id !== payload?.id));
    },
    [],
  );

  useSocketEvent<any>(
    getChatSocket,
    'reaction:added',
    (payload) => {
      setMessages((old) =>
        old.map((item) => {
          if (item.id !== payload?.messageId) {
            return item;
          }

          const nextReactionId = `${payload.messageId}:${payload.userId}:${payload.emoji}`;
          const hasExisting = (item.reactions ?? []).some(
            (reaction) =>
              reaction.emoji === payload.emoji &&
              reaction.userId === payload.userId,
          );

          if (hasExisting) {
            return item;
          }

          return {
            ...item,
            reactions: [
              ...(item.reactions ?? []),
              {
                id: nextReactionId,
                messageId: payload.messageId,
                userId: payload.userId,
                emoji: payload.emoji,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          };
        }),
      );
    },
    [],
  );

  useSocketEvent<any>(
    getChatSocket,
    'reaction:removed',
    (payload) => {
      setMessages((old) =>
        old.map((item) =>
          item.id === payload.messageId
            ? {
                ...item,
                reactions: (item.reactions ?? []).filter(
                  (reaction) =>
                    !(
                      reaction.emoji === payload.emoji &&
                      reaction.userId === payload.userId
                    ),
                ),
              }
            : item,
        ),
      );
    },
    [],
  );

  useSocketEvent<any>(
    getNotificationsSocket,
    'notification:recieved',
    (payload) => {
      toast({
        title: 'Notification',
        description: payload?.content ?? 'You received an update.',
        status: 'info',
        duration: 1800,
        position: 'top',
        isClosable: true,
      });
    },
    [toast],
  );

  useEffect(() => {
    let isMounted = true;
    let roomType: 'channel' | 'dm' = 'channel';

    async function joinRoom() {
      const socket = getChatSocket();
      if (!socket) {
        return;
      }

      try {
        const channel = await getChannel(channelId);
        if (channel?.type === 'dm') {
          roomType = 'dm';
          socket.emit('dm:join', { channelId });
        } else {
          socket.emit('channel:join', { serverId, channelId });
        }
      } catch {
        socket.emit('channel:join', { serverId, channelId });
      }
    }

    void joinRoom();

    fetchMessages().then(() => {
      if (isMounted) {
        scrollToBottom();
      }
    });

    return () => {
      isMounted = false;
      const socket = getChatSocket();
      if (!socket) {
        return;
      }

      if (roomType === 'dm') {
        socket.emit('dm:leave', { channelId });
      } else {
        socket.emit('channel:leave', { serverId, channelId });
      }
    };
  }, [channelId, fetchMessages, scrollToBottom, serverId]);

  const MessageList = () => (
    <>
      {messages.map((message) => (
        <AppMessageContainer
          key={message.id}
          message={message}
          onToggleReaction={toggleReaction}
          currentUserId={currentUser?.id}
          onReply={(nextMessage) => setReplyTarget(nextMessage)}
          onOpenThread={(msg) => {
            setThreadRoot(msg);
            onThreadOpen();
          }}
          onMessageUpdated={() => {
            void fetchMessages();
          }}
        />
      ))}
    </>
  );

  return (
    <>
      <Box
        display="flex"
        flexGrow={1}
        flexDirection="column-reverse"
        height="0px"
        overflowY="scroll"
      >
        <div
          ref={bottom}
          style={{
            color: 'blue',
            height: '100px',
            width: '100px',
            position: 'relative',
          }}
        />

        {/* Messages */}
        {isLoading ? (
          <Center height="100%">
            <Spinner size="xl" color="white" />
          </Center>
        ) : hasMessages ? (
          <MessageList />
        ) : (
          <Center height="100vh">
            <Text color="white">No messages</Text>
          </Center>
        )}
      </Box>

      {typingLabel && (
        <Box
          marginY="5px"
          display="flex"
          justifyContent="start"
          alignItems="center"
          paddingX="15px"
        >
          <Text color="whiteAlpha.700" fontSize="sm" fontStyle="italic">
            {typingLabel}
          </Text>
        </Box>
      )}

      <AppChatInput
        scrollToBottom={scrollToBottom}
        serverId={serverId}
        channelId={channelId}
        replyTarget={replyTarget}
        onClearReplyTarget={() => setReplyTarget(null)}
      />

      <AppThreadPanel
        isOpen={isThreadOpen}
        onClose={onThreadClose}
        rootMessage={threadRoot}
        serverId={serverId}
        channelId={channelId}
        onMessageSent={() => {
          // Refresh messages when a reply is sent in the thread
          fetchMessages();
        }}
      />
    </>
  );
}

type AppMessageContainerProps = {
  message: Message;
  currentUserId?: string | null;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  onReply: (message: Message) => void;
  onOpenThread: (message: Message) => void;
  onMessageUpdated: VoidFunction;
};

function AppMessageContainer({
  message,
  currentUserId,
  onToggleReaction,
  onReply,
  onOpenThread,
  onMessageUpdated,
}: AppMessageContainerProps) {
  const canEditOwnMessage = canEditMessage(currentUserId, message.sent_by);
  const canDeleteOwnMessage = canDeleteMessage(currentUserId, message.sent_by);
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  const reactionGroups = (message.reactions ?? []).reduce(
    (groups, reaction) => {
      const existing = groups[reaction.emoji] ?? {
        emoji: reaction.emoji,
        count: 0,
        reactedByMe: false,
      };

      existing.count += 1;
      if (reaction.userId === currentUserId) {
        existing.reactedByMe = true;
      }

      groups[reaction.emoji] = existing;
      return groups;
    },
    {} as Record<
      string,
      { emoji: string; count: number; reactedByMe: boolean }
    >,
  );

  const isToday =
    new Date(message.created_at).toLocaleDateString() ===
    new Date().toLocaleDateString();

  const date = `${
    isToday ? 'Today' : new Date(message.created_at).toLocaleDateString()
  } at ${new Date(message.created_at).toLocaleTimeString()}`;

  async function deleteMessage() {
    try {
      await deleteChatMessage(String(message.id));
      onMessageUpdated();
    } catch (error) {
      console.error('Failed to delete message', error);
    }
  }

  async function saveEdit() {
    if (!editText.trim()) {
      return;
    }

    try {
      await editChatMessage(String(message.id), editText);
      setIsEditing(false);
      onMessageUpdated();
    } catch (error) {
      console.error('Failed to edit message');
      return;
    }
  }

  return (
    <Box
      position="relative"
      paddingY="5px"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Message Content */}
      <Box
        display="flex"
        paddingX="15px"
        paddingY="5px"
        _hover={{ backgroundColor: colors.darkLight }}
      >
        <Avatar
          src={message.app_users?.avatar}
          name={message.app_users?.name}
          marginRight="15px"
        />
        <Box flex="1">
          <Box justifyContent="start" alignItems="end" display="flex">
            <Text color="white" fontSize="xs" fontWeight="bold">
              <Link>{message.app_users?.name}</Link>
            </Text>
            <Box width="10px" />
            <Text fontSize="12px" color="whiteAlpha.500">
              {date}
            </Text>
          </Box>
          {isEditing ? (
            <Box display="flex" gap="8px" marginTop="5px">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={saveEdit}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#43b581',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditText(message.text);
                }}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#f04747',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Cancel
              </button>
            </Box>
          ) : (
            <Box>
              {message.parentMessageId ? (
                <Text fontSize="xs" color="whiteAlpha.600" marginBottom="4px">
                  Replying in thread
                </Text>
              ) : null}
              <Text fontSize="sm" color="white">
                {message.text}
              </Text>
            </Box>
          )}

          {message.attachments?.length ? (
            <Box marginTop="8px">
              {message.attachments.map((attachment) => (
                <Box
                  key={attachment.id ?? attachment.url}
                  marginTop="4px"
                  padding="8px"
                  borderRadius="md"
                  backgroundColor={colors.darkLight}
                >
                  <a
                    href={normalizeBlobUrl(attachment.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Text color="blue.300" fontSize="sm">
                      {attachment.fileName ?? attachment.url}
                    </Text>
                  </a>
                </Box>
              ))}
            </Box>
          ) : null}

          {(Object.values(reactionGroups).length > 0 || isHovering) && (
            <Box display="flex" flexWrap="wrap" gap="6px" marginTop="8px">
              {Object.values(reactionGroups).map((reaction) => (
                <button
                  key={`${message.id}-${reaction.emoji}`}
                  onClick={() => onToggleReaction(message.id!, reaction.emoji)}
                  style={{
                    border: '1px solid',
                    borderColor: reaction.reactedByMe ? '#43b581' : '#4f545c',
                    backgroundColor: reaction.reactedByMe
                      ? '#2f3136'
                      : '#202225',
                    color: 'white',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {reaction.emoji} {reaction.count}
                </button>
              ))}

              {isHovering &&
                REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={`${message.id}-${emoji}-picker`}
                    onClick={() => onToggleReaction(message.id!, emoji)}
                    title={`React with ${emoji}`}
                    style={{
                      border: '1px solid #4f545c',
                      backgroundColor: '#202225',
                      color: 'white',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {emoji}
                  </button>
                ))}

              {isHovering && (
                <>
                  <button
                    onClick={() => onReply(message)}
                    style={{
                      border: '1px solid #4f545c',
                      backgroundColor: '#202225',
                      color: 'white',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => onOpenThread(message)}
                    style={{
                      border: '1px solid #4f545c',
                      backgroundColor: '#202225',
                      color: 'white',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    title="View thread"
                  >
                    💬
                  </button>
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Edit/Delete Buttons */}
      {canDeleteOwnMessage && isHovering && !isEditing && (
        <Box
          position="absolute"
          top="10px"
          right="15px"
          display="flex"
          gap="5px"
          backgroundColor={colors.darkMedium}
          padding="5px"
          borderRadius="4px"
        >
          {canEditOwnMessage ? (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit"
              style={{
                background: 'none',
                border: 'none',
                color: '#43b581',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 4px',
              }}
            >
              ✏️
            </button>
          ) : null}
          <button
            onClick={deleteMessage}
            title="Delete"
            style={{
              background: 'none',
              border: 'none',
              color: '#f04747',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 4px',
            }}
          >
            🗑️
          </button>
        </Box>
      )}
    </Box>
  );
}
