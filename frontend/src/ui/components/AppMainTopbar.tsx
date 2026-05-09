import { IconButton } from '@chakra-ui/button';
import {
  AtSignIcon,
  BellIcon,
  QuestionIcon,
  StarIcon,
  TimeIcon,
} from '@chakra-ui/icons';
import { Input } from '@chakra-ui/input';
import {
  Box,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import React, { useState } from 'react';
import { useHistory, useParams } from 'react-router';
import { colors } from '../theme/colors';
import AppIconButton from './AppIconButton';
import AppNotificationCenter from './AppNotificationCenter';
import { searchMessages } from '../../app/services/message.service';

type SearchResult = {
  id?: string;
  content?: string;
  text?: string;
  createdAt?: string;
  created_at?: string;
  channelId?: string;
  channel_id?: string;
  authorId?: string;
  sent_by?: string;
};

export default function AppMainTopbar() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const history = useHistory();
  const toast = useToast();
  const params = useParams<{ serverId?: string; channelId?: string }>();

  const normalizedQuery = query.trim();

  async function runSearch() {
    if (!normalizedQuery) {
      setResults([]);
      setSearchTotal(null);
      return;
    }

    try {
      setIsSearching(true);
      const data = await searchMessages({
        keyword: normalizedQuery,
        channelId: params.channelId,
        serverId: params.serverId,
        limit: 10,
      });

      setResults(Array.isArray(data.items) ? data.items : []);
      setSearchTotal(typeof data.total === 'number' ? data.total : null);
      onOpen();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Search failed',
        description: 'Could not load message results.',
        status: 'error',
        duration: 2000,
        position: 'top',
      });
    } finally {
      setIsSearching(false);
    }
  }

  function handleResultClick(result: SearchResult) {
    if (params.serverId && (result.channelId ?? result.channel_id)) {
      history.push(
        `/servers/${params.serverId}/channels/${result.channelId ?? result.channel_id}`,
      );
    }
    onClose();
  }

  return (
    <>
      <Box
        height="50px"
        backgroundColor={colors.grayLight}
        borderBottomColor="gray"
        borderBottomWidth="1px"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        paddingX="10px"
      >
        <AppMainTopbarChannelName />
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap="8px"
        >
          <AppNotificationCenter />
          <AppIconButton
            tooltip="Mute a channel"
            ariaLabel="Mute channel"
            icon={<BellIcon />}
          ></AppIconButton>
          <AppIconButton
            tooltip="Pinned Messages"
            ariaLabel="View pinned messages"
            icon={<AtSignIcon />}
          ></AppIconButton>
          <AppIconButton
            tooltip="Member List"
            ariaLabel="Toggle Memberlist"
            icon={<StarIcon />}
          ></AppIconButton>
          <Input
            placeholder="Search messages"
            color="white"
            width="150px"
            size="sm"
            borderRadius="md"
            borderColor="transparent"
            backgroundColor={colors.grayDarkest}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void runSearch();
              }
            }}
            _focus={{
              width: '225px',
            }}
          />
          <AppIconButton
            tooltip="Search messages"
            ariaLabel="Search messages"
            icon={<TimeIcon />}
            onClick={() => void runSearch()}
          ></AppIconButton>
          <AppIconButton
            tooltip="Inbox"
            ariaLabel="See inbox"
            icon={<TimeIcon />}
          ></AppIconButton>
          <AppIconButton
            tooltip="Help"
            ariaLabel="Toggle Memberlist"
            icon={<QuestionIcon />}
          ></AppIconButton>
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent backgroundColor={colors.grayLight} color="white">
          <ModalHeader>
            Search results {searchTotal !== null ? `(${searchTotal})` : ''}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {isSearching ? (
              <Text color="gray.400">Searching...</Text>
            ) : results.length ? (
              <Box>
                {results.map((result, index) => (
                  <Box key={result.id ?? `${index}`} marginBottom="10px">
                    <Box
                      padding="10px"
                      borderRadius="md"
                      backgroundColor={colors.grayDark}
                      cursor="pointer"
                      onClick={() => handleResultClick(result)}
                    >
                      <HStack justifyContent="space-between" alignItems="start">
                        <Box>
                          <Text fontSize="sm" fontWeight="bold">
                            {result.content ??
                              result.text ??
                              'Untitled message'}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            Channel:{' '}
                            {result.channelId ?? result.channel_id ?? 'unknown'}
                          </Text>
                        </Box>
                        <Text fontSize="xs" color="gray.500">
                          {result.createdAt ?? result.created_at ?? ''}
                        </Text>
                      </HStack>
                    </Box>
                    <Divider borderColor="gray.600" marginTop="10px" />
                  </Box>
                ))}
              </Box>
            ) : (
              <Text color="gray.400">
                No results yet. Search a message keyword above.
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

function AppMainTopbarChannelName() {
  return (
    <Box display="flex" alignItems="center" cursor="default">
      <Text
        marginRight="10px"
        fontStyle="italic"
        color="gray.500"
        fontSize="xl"
      >
        #
      </Text>
      <Text color="white">
        💬-general (Server is hosted on Singapore region)
      </Text>
    </Box>
  );
}
