import React, { useEffect, useState } from 'react';
import {
  Box,
  Text,
  Center,
  Spinner,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from '@chakra-ui/react';
import { Avatar } from '@chakra-ui/avatar';
import { colors } from '../theme/colors';
import { Message, AppUser } from '../../app/datamodels';
import AppChatInput from './AppChatInput';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchThreadMessages,
  toggleMessageReaction as toggleThreadReaction,
  normalizeMessage,
} from '../../app/services/message.service';
import { normalizeBlobUrl } from '../../app/services/api.service';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉'];

export type AppThreadPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  rootMessage: Message | null;
  serverId: string;
  channelId: string;
  onMessageSent?: () => void;
};

export default function AppThreadPanel({
  isOpen,
  onClose,
  rootMessage,
  serverId,
  channelId,
  onMessageSent,
}: AppThreadPanelProps) {
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [isLoading, setLoading] = useState(false);
  const currentUser = useAuth();

  useEffect(() => {
    if (!isOpen || !rootMessage?.id) {
      return;
    }

    void loadThreadMessages();
  }, [isOpen, rootMessage?.id]);

  const loadThreadMessages = async () => {
    if (!rootMessage?.id) return;

    setLoading(true);
    try {
      const data = await fetchThreadMessages(rootMessage.id);
      const messages = data
        .filter((msg: any) => msg.id !== rootMessage.id) // exclude root message
        .map((msg: any) => normalizeMessage(msg));

      setThreadMessages(messages);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      setLoading(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const currentMessage = [rootMessage, ...threadMessages].find(
      (m) => m?.id === messageId,
    );
    if (!currentMessage) return;

    const hasReaction = (currentMessage.reactions ?? []).some(
      (reaction) =>
        reaction.emoji === emoji && reaction.userId === currentUser?.id,
    );

    try {
      await toggleThreadReaction(messageId, emoji, hasReaction);
      await loadThreadMessages();
    } catch (error) {
      console.error('Failed to update thread reaction', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent
        backgroundColor={colors.darkMedium}
        borderRadius="8px"
        maxHeight="80vh"
        display="flex"
        flexDirection="column"
      >
        <ModalHeader
          color="white"
          borderBottomWidth="1px"
          borderBottomColor={colors.darkLight}
        >
          Thread
        </ModalHeader>
        <ModalCloseButton color="white" />
        <ModalBody
          flex="1"
          overflowY="auto"
          display="flex"
          flexDirection="column"
          padding="0px"
        >
          {isLoading ? (
            <Center height="100%" paddingY="20px">
              <Spinner size="lg" color="white" />
            </Center>
          ) : (
            <>
              {rootMessage && (
                <Box
                  borderBottomWidth="1px"
                  borderBottomColor={colors.darkLight}
                >
                  <ThreadMessageItem
                    message={rootMessage}
                    isRoot
                    currentUserId={currentUser?.id}
                    onToggleReaction={toggleReaction}
                  />
                </Box>
              )}

              {threadMessages.length === 0 ? (
                <Center paddingY="20px">
                  <Text color="whiteAlpha.600">No replies yet</Text>
                </Center>
              ) : (
                threadMessages.map((msg) => (
                  <ThreadMessageItem
                    key={msg.id}
                    message={msg}
                    currentUserId={currentUser?.id}
                    onToggleReaction={toggleReaction}
                  />
                ))
              )}
            </>
          )}
        </ModalBody>

        {/* Chat Input for Thread */}
        <Box
          borderTopWidth="1px"
          borderTopColor={colors.darkLight}
          padding="12px"
          backgroundColor={colors.darkMedium}
        >
          <AppChatInput
            scrollToBottom={() => {}}
            serverId={serverId}
            channelId={channelId}
            replyTarget={rootMessage}
            onClearReplyTarget={() => {}}
            onMessageSent={onMessageSent}
          />
        </Box>
      </ModalContent>
    </Modal>
  );
}

type ThreadMessageItemProps = {
  message: Message;
  currentUserId?: string | null;
  isRoot?: boolean;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
};

function ThreadMessageItem({
  message,
  currentUserId,
  isRoot = false,
  onToggleReaction,
}: ThreadMessageItemProps) {
  const [isHovering, setIsHovering] = useState(false);

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

  return (
    <Box
      display="flex"
      paddingX="15px"
      paddingY="8px"
      borderLeft={isRoot ? `3px solid ${colors.primary}` : 'none'}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      _hover={{ backgroundColor: colors.darkLight }}
    >
      <Avatar
        src={message.app_users?.avatar}
        name={message.app_users?.name}
        marginRight="12px"
        size="sm"
      />
      <Box flex="1">
        <Box justifyContent="start" alignItems="end" display="flex">
          <Text color="white" fontSize="xs" fontWeight="bold">
            <Link>{message.app_users?.name}</Link>
          </Text>
          <Box width="10px" />
          <Text fontSize="11px" color="whiteAlpha.500">
            {date}
          </Text>
          {isRoot && (
            <Text fontSize="11px" color="whiteAlpha.600" marginLeft="8px">
              (Original)
            </Text>
          )}
        </Box>
        <Text fontSize="sm" color="white" marginTop="4px">
          {message.text}
        </Text>

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
                  borderColor: reaction.reactedByMe
                    ? colors.primary
                    : '#4f545c',
                  backgroundColor: reaction.reactedByMe ? '#2f3136' : '#202225',
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
          </Box>
        )}
      </Box>
    </Box>
  );
}
