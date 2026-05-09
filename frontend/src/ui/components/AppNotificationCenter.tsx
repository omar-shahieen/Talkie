import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Badge,
  Text,
  VStack,
  HStack,
  Button,
  Skeleton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Spinner,
  Center,
  useToast,
} from '@chakra-ui/react';
import { BellIcon } from '@chakra-ui/icons';
import { colors } from '../theme/colors';
import { getNotificationsSocket } from '../../app/supabase';
import {
  fetchNotifications,
  markNotificationAsRead,
} from '../../app/services/notification.service';
import { useSocketEvent } from '../../hooks/useSocketEvent';

type Notification = {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  created_at: string;
  link?: string;
};

export type AppNotificationCenterProps = {
  onNotificationClick?: (notification: Notification) => void;
};

export default function AppNotificationCenter({
  onNotificationClick,
}: AppNotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const initialRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    void fetchNotificationsList();
  }, []);

  const fetchNotificationsList = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const notifs = await fetchNotifications();
      setNotifications(notifs);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setErrorMessage('Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useSocketEvent<any>(
    getNotificationsSocket,
    'notification:recieved',
    (payload) => {
      const newNotification: Notification = {
        id: payload.id || `notif-${Date.now()}`,
        title: payload.title || 'New Notification',
        content: payload.content || payload.message || '',
        isRead: false,
        created_at: new Date().toISOString(),
        link: payload.link,
      };

      setNotifications((prev) => {
        const exists = prev.some((item) => item.id === newNotification.id);
        if (exists) {
          return prev.map((item) =>
            item.id === newNotification.id
              ? { ...item, ...newNotification }
              : item,
          );
        }

        return [newNotification, ...prev];
      });
    },
    [],
  );

  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif,
        ),
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: 'Could not update notification',
        description: 'Please try again.',
        status: 'error',
        duration: 2200,
        isClosable: true,
      });
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);

    await Promise.all(unreadIds.map((id) => markAsRead(id)));
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasUnread = unreadCount > 0;

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <Popover
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      initialFocusRef={initialRef}
      placement="bottom-start"
    >
      <PopoverTrigger>
        <Box
          position="relative"
          cursor="pointer"
          onClick={() => setIsOpen(!isOpen)}
          display="flex"
          alignItems="center"
          justifyContent="center"
          width="32px"
          height="32px"
          borderRadius="6px"
          _hover={{ backgroundColor: colors.darkLight }}
          title="Notifications"
        >
          <BellIcon color="white" fontSize="18px" />
          {hasUnread && (
            <Badge
              position="absolute"
              top="-4px"
              right="-4px"
              backgroundColor="#f04747"
              color="white"
              borderRadius="full"
              padding="1px 4px"
              fontSize="10px"
              fontWeight="bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>

      <PopoverContent
        backgroundColor={colors.darkMedium}
        borderColor={colors.darkLight}
        width="360px"
        maxHeight="500px"
        display="flex"
        flexDirection="column"
      >
        <PopoverArrow backgroundColor={colors.darkMedium} />
        <PopoverHeader
          borderBottomWidth="1px"
          borderBottomColor={colors.darkLight}
          color="white"
          fontWeight="bold"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text>Notifications {unreadCount > 0 && `(${unreadCount})`}</Text>
          {unreadCount > 0 && (
            <Button
              size="xs"
              variant="ghost"
              color="whiteAlpha.700"
              _hover={{ color: 'white' }}
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </PopoverHeader>

        <PopoverCloseButton color="white" />

        <PopoverBody padding="0px" overflowY="auto" maxHeight="400px" flex="1">
          {isLoading ? (
            <VStack spacing="8px" align="stretch" padding="12px">
              <Skeleton height="40px" borderRadius="md" />
              <Skeleton height="40px" borderRadius="md" />
              <Skeleton height="40px" borderRadius="md" />
              <Center>
                <Spinner size="sm" color="white" />
              </Center>
            </VStack>
          ) : errorMessage ? (
            <Center height="120px" flexDirection="column" gap="10px">
              <Text color="red.200" fontSize="sm">
                {errorMessage}
              </Text>
              <Button size="sm" onClick={() => void fetchNotificationsList()}>
                Retry
              </Button>
            </Center>
          ) : notifications.length === 0 ? (
            <Center height="100px">
              <Text color="whiteAlpha.600" fontSize="sm">
                No notifications
              </Text>
            </Center>
          ) : (
            <VStack spacing="0" align="stretch">
              {notifications.map((notification, index) => (
                <Box
                  key={notification.id}
                  padding="12px"
                  borderBottomWidth={
                    index < notifications.length - 1 ? '1px' : '0px'
                  }
                  borderBottomColor={colors.darkLight}
                  backgroundColor={
                    notification.isRead
                      ? 'transparent'
                      : 'rgba(79, 84, 92, 0.2)'
                  }
                  cursor="pointer"
                  _hover={{ backgroundColor: colors.darkLight }}
                  transition="background-color 0.2s"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <HStack
                    justify="space-between"
                    align="flex-start"
                    spacing="8px"
                  >
                    <VStack align="start" spacing="4px" flex="1">
                      <HStack justify="space-between" width="100%">
                        <Text
                          color="white"
                          fontWeight={notification.isRead ? 'normal' : 'bold'}
                          fontSize="sm"
                          flex="1"
                        >
                          {notification.title}
                        </Text>
                        <Text color="whiteAlpha.500" fontSize="xs">
                          {formatTime(notification.created_at)}
                        </Text>
                      </HStack>
                      <Text color="whiteAlpha.700" fontSize="xs">
                        {notification.content}
                      </Text>
                    </VStack>
                    {!notification.isRead && (
                      <Box
                        width="8px"
                        height="8px"
                        borderRadius="full"
                        backgroundColor="#5865f2"
                        flexShrink={0}
                        marginTop="4px"
                      />
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
