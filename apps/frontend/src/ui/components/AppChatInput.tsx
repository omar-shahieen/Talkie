import React, { useEffect, useRef, useState } from 'react';
import { Box, Input, Text } from '@chakra-ui/react';
import {
  AddIcon,
  AtSignIcon,
  CalendarIcon,
  LinkIcon,
  ArrowForwardIcon,
} from '@chakra-ui/icons';
import AppIconButton from './AppIconButton';
import { useThemedColors } from '../theme/colors';
import { getChatSocket } from '../../app/supabase';
import { Message } from '../../app/datamodels';
import { useAuth } from '../../hooks/useAuth';
import {
  sendMessage as sendChatMessage,
  uploadMessageFiles,
} from '../../app/services/message.service';

const GUEST_USER_ID = '78085bee-8de6-4d20-afa7-4375d9971064';

type SendMessageDto = {
  channelId: string;
  message: string;
  attachments?: Array<{
    url: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
};

export type AppChatInputProps = {
  scrollToBottom: VoidFunction;
  serverId: string;
  channelId: string;
  replyTarget?: Message | null;
  onClearReplyTarget?: VoidFunction;
  onMessageSent?: (message: Message) => void;
};

export default function AppChatInput({
  scrollToBottom,
  serverId,
  channelId,
  replyTarget,
  onClearReplyTarget,
  onMessageSent,
}: AppChatInputProps) {
  const colors = useThemedColors();
  const [message, setMessage] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [uploadedAttachments, setUploadedAttachments] = useState<
    SendMessageDto['attachments']
  >([]);
  const user = useAuth();
  const typingTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function stopTyping() {
    const socket = getChatSocket();

    if (socket && isTypingRef.current) {
      socket.emit('typing:stop', { serverId, channelId });
    }

    isTypingRef.current = false;

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }

  function startTyping() {
    const socket = getChatSocket();
    if (!socket) {
      return;
    }

    if (!isTypingRef.current) {
      socket.emit('typing:start', { serverId, channelId });
      isTypingRef.current = true;
    }

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = window.setTimeout(() => {
      stopTyping();
    }, 1200);
  }

  async function sendMessage({
    channelId,
    message,
    attachments = [],
  }: SendMessageDto): Promise<Message | null | undefined> {
    setLoading(true);
    setErrorMessage('');
    stopTyping();

    try {
      const sentMessage = await sendChatMessage({
        channelId,
        content: message,
        parentMessageId: replyTarget?.id ?? null,
        threadRootMessageId:
          replyTarget?.threadRootMessageId ?? replyTarget?.id ?? null,
        attachments,
        guestUserId: user?.id ?? GUEST_USER_ID,
      });

      setMessage('');
      setUploadedAttachments([]);
      onClearReplyTarget?.();
      onMessageSent?.(sentMessage);
      scrollToBottom();
      return sentMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      setErrorMessage('Failed to send message. Please try again.');
      setLoading(false);
      return null;
    } finally {
      setLoading(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    try {
      setLoading(true);
      const attachments = await uploadMessageFiles(
        channelId,
        Array.from(fileList),
      );
      setUploadedAttachments((current) => [...(current ?? []), ...attachments]);
    } catch (error) {
      console.error('Error uploading files:', error);
      setErrorMessage('Failed to upload files.');
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    if (!message && !uploadedAttachments?.length) {
      return;
    }

    sendMessage({
      channelId,
      message,
      attachments: uploadedAttachments ?? [],
    });
  }

  function onKeyPress({ key }: any) {
    if (key === 'Enter') {
      handleSend();
    }
  }

  function onInput(event: any) {
    if (!event) {
      return;
    }

    const nextMessage = event?.target?.value ?? '';
    setMessage(nextMessage);

    if (nextMessage) {
      startTyping();
    } else {
      stopTyping();
    }
  }

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, []);

  return (
    <Box paddingX="15px" backgroundColor={colors.grayLight}>
      {replyTarget ? (
        <Box marginBottom="6px" color={colors.textDim} fontSize="sm">
          Replying to {replyTarget.app_users?.name ?? 'message'}
          <button
            onClick={onClearReplyTarget}
            style={{
              marginLeft: '8px',
              color: colors.lightGray,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </Box>
      ) : null}
      <Box
        display="flex"
        justifyContent="space-around"
        alignItems="center"
        backgroundColor={colors.darkLight}
        padding="5px"
        borderRadius="8px"
      >
        <AppIconButton
          ariaLabel="Attach files"
          size="sm"
          withBackground
          icon={<AddIcon />}
          onClick={openFilePicker}
        />
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          display="none"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            void uploadFiles(event.target.files)
          }
        />
        <Box marginX="3px" />
        <Input
          height="35px"
          backgroundColor="transparent"
          color={colors.white}
          value={message}
          borderColor="transparent"
          placeholder="Message"
          _placeholder={{ color: colors.textMuted }}
          onInput={onInput}
          onKeyPress={onKeyPress}
          disabled={isLoading}
        />
        <AppIconButton
          ariaLabel="Attach files"
          icon={<CalendarIcon />}
          onClick={openFilePicker}
        />
        <AppIconButton
          ariaLabel="Send message"
          icon={<ArrowForwardIcon />}
          onClick={handleSend}
          disabled={isLoading || (!message.trim() && !uploadedAttachments?.length)}
          colorScheme="blue"
        />
        <AppIconButton ariaLabel="Select emoji" icon={<AtSignIcon />} />
      </Box>
      {uploadedAttachments?.length ? (
        <Box marginTop="8px" color={colors.white} fontSize="sm">
          <Text fontWeight="bold" marginBottom="4px">
            Attached files
          </Text>
          {uploadedAttachments.map((attachment) => (
            <Text key={attachment.url}>
              {attachment.fileName ?? attachment.url}
            </Text>
          ))}
        </Box>
      ) : null}
      {errorMessage ? (
        <Text marginTop="6px" color="red.300" fontSize="sm">
          {errorMessage}
        </Text>
      ) : null}
    </Box>
  );
}
