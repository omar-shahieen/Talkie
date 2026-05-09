import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/layout';
import { AddIcon, AtSignIcon, CalendarIcon, LinkIcon } from '@chakra-ui/icons';
import { Input } from '@chakra-ui/input';
import AppIconButton from './AppIconButton';
import { colors } from '../theme/colors';
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
  onMessageSent?: VoidFunction;
};

export default function AppChatInput({
  scrollToBottom,
  serverId,
  channelId,
  replyTarget,
  onClearReplyTarget,
  onMessageSent,
}: AppChatInputProps) {
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
      scrollToBottom();
      onMessageSent?.();
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

  function onKeyPress({ key }: any) {
    if (!message) {
      return;
    }

    if (key === 'Enter') {
      console.log('onKeyPress', { key, message });

      sendMessage({
        channelId,
        message,
        attachments: uploadedAttachments ?? [],
      });
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
        <Box marginBottom="6px" color="whiteAlpha.800" fontSize="sm">
          Replying to {replyTarget.app_users?.name ?? 'message'}
          <button
            onClick={onClearReplyTarget}
            style={{
              marginLeft: '8px',
              color: '#a0aec0',
              background: 'none',
              border: 'none',
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
          onChange={(event) => void uploadFiles(event.target.files)}
        />
        <Box marginX="3px" />
        <Input
          height="35px"
          backgroundColor="transparent"
          color="white"
          value={message}
          borderColor="transparent"
          placeholder="Message"
          onInput={onInput}
          onKeyPress={onKeyPress}
          disabled={isLoading}
        />
        <AppIconButton
          ariaLabel="Attach files"
          icon={<CalendarIcon />}
          onClick={openFilePicker}
        />
        <AppIconButton ariaLabel="Select giphy" icon={<LinkIcon />} />
        <AppIconButton ariaLabel="Select emoji" icon={<AtSignIcon />} />
      </Box>
      {uploadedAttachments?.length ? (
        <Box marginTop="8px" color="white" fontSize="sm">
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
