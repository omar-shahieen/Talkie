import {
  AtSignIcon,
  BellIcon,
  EmailIcon,
  MoonIcon,
  NotAllowedIcon,
  SearchIcon,
  QuestionIcon,
  StarIcon,
  SunIcon,
} from '@chakra-ui/icons';
import {
  Box,
  Divider,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  useColorMode,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useThemedColors } from '../theme/colors';
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
  const colors = useThemedColors();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isHelpOpen,
    onOpen: onHelpOpen,
    onClose: onHelpClose,
  } = useDisclosure();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const { colorMode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
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
      navigate(
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
            icon={<NotAllowedIcon />}
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
            color={colors.white}
            _placeholder={{ color: colors.textMuted }}
            width="150px"
            size="sm"
            borderRadius="md"
            borderColor="transparent"
            backgroundColor={colors.grayDarkest}
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setQuery(event.target.value)
            }
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
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
            icon={<SearchIcon />}
            onClick={() => void runSearch()}
          ></AppIconButton>
          <AppIconButton
            tooltip="Inbox"
            ariaLabel="See inbox"
            icon={<EmailIcon />}
          ></AppIconButton>
          <AppIconButton
            tooltip="Help"
            ariaLabel="Open help"
            icon={<QuestionIcon />}
            onClick={onHelpOpen}
          ></AppIconButton>
          <AppIconButton
            tooltip={colorMode === 'dark' ? 'Light mode' : 'Dark mode'}
            ariaLabel="Toggle theme"
            icon={colorMode === 'dark' ? <SunIcon /> : <MoonIcon />}
            onClick={toggleColorMode}
          ></AppIconButton>
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent backgroundColor={colors.grayLight} color={colors.dark}>
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

      <Modal isOpen={isHelpOpen} onClose={onHelpClose} size="md" isCentered>
        <ModalOverlay />
        <ModalContent backgroundColor={colors.grayLight} color={colors.dark}>
          <ModalHeader>Help</ModalHeader>
          <ModalCloseButton />
          <ModalBody paddingBottom="20px">
            <Box display="grid" gap="10px">
              <Text fontSize="sm" color="gray.300">
                Search messages by typing a keyword and pressing Enter or the
                search button.
              </Text>
              <Text fontSize="sm" color="gray.300">
                Use the notification bell to review unread activity in real
                time.
              </Text>
              <Text fontSize="sm" color="gray.300">
                Mute, inbox, and pinned message actions will be connected here
                when their handlers are added.
              </Text>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

function AppMainTopbarChannelName() {
  const colors = useThemedColors();
  return (
    <Box display="flex" alignItems="center" cursor="default">
      <Text
        marginRight="10px"
        fontStyle="italic"
        color={colors.lightGray}
        fontSize="xl"
      >
        #
      </Text>
      <Text color={colors.white}>
        💬-general (Server is hosted on Singapore region)
      </Text>
    </Box>
  );
}
