import React from 'react';
import { Box, Text } from '@chakra-ui/layout';
import {
  useUserPresence,
  getPresenceColor,
  getPresenceLabel,
} from '../../hooks/usePresence';

export type AppCategoryItemProps = {
  label: string;
  active?: boolean;
  onClick?: VoidFunction;
  isDm?: boolean;
  userId?: string;
};

export default function AppChannelListItem({
  label,
  active,
  onClick,
  isDm,
  userId,
}: AppCategoryItemProps) {
  const presence = useUserPresence(isDm ? userId : undefined);
  const presenceColor = getPresenceColor(presence.status);
  const presenceLabel = getPresenceLabel(presence.status);

  return (
    <Box
      display="flex"
      justifyContent="start"
      alignItems="center"
      padding="3px"
      backgroundColor={active ? 'gray.500' : 'transparent'}
      borderRadius="3px"
      marginY="2px"
      cursor="pointer"
      onClick={onClick}
      _hover={{
        backgroundColor: 'gray.600',
      }}
      position="relative"
      title={isDm ? `${label} - ${presenceLabel}` : undefined}
    >
      {isDm ? (
        <Box
          width="6px"
          height="6px"
          borderRadius="full"
          backgroundColor={presenceColor}
          marginRight="8px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        />
      ) : (
        <Text
          color="gray.300"
          marginRight="10px"
          fontStyle="italic"
          fontSize="xl"
        >
          #
        </Text>
      )}
      <Text color="white">{label}</Text>
      <Box flex="1" />
      {isDm && presence.status !== 'offline' && (
        <Text color="whiteAlpha.500" fontSize="xs" marginRight="4px">
          ●
        </Text>
      )}
    </Box>
  );
}
