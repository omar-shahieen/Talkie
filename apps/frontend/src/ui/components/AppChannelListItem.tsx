import React from 'react';
import { Box, Text } from '@chakra-ui/react';
import {
  useUserPresence,
  getPresenceColor,
  getPresenceLabel,
} from '../../hooks/usePresence';

import { useThemedColors } from '../theme/colors';

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
  const colors = useThemedColors();

  return (
    <Box
      display="flex"
      justifyContent="start"
      alignItems="center"
      padding="3px"
      backgroundColor={active ? colors.darkLight : 'transparent'}
      borderRadius="3px"
      marginY="2px"
      cursor="pointer"
      onClick={onClick}
      _hover={{
        backgroundColor: colors.darkLight,
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
          color={colors.lightGray}
          marginRight="10px"
          fontStyle="italic"
          fontSize="xl"
        >
          #
        </Text>
      )}
      <Text color={colors.white}>{label}</Text>
      <Box flex="1" />
      {isDm && presence.status !== 'offline' && (
        <Text color={colors.textMuted} fontSize="xs" marginRight="4px">
          ●
        </Text>
      )}
    </Box>
  );
}
