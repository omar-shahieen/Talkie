import { Avatar, Box, Text, Tooltip } from "@chakra-ui/react";
import React from "react";

import { useThemedColors } from "../theme/colors";

export type AppMemberListItemProps = {
  name: string;
  isOwner?: boolean;
};

export default function AppMemberListItem({
  name,
  isOwner,
}: AppMemberListItemProps) {
  const colors = useThemedColors();
  return (
    <Box
      display="flex"
      alignItems="center"
      padding="5px"
      marginY="5px"
      borderRadius="3px"
      cursor="pointer"
      _hover={{
        backgroundColor: colors.darkLight,
      }}
    >
      <Avatar size="sm" />
      <Box width="10px" />
      <Text color={colors.white}>{name}</Text>
      {isOwner ? (
        <Box marginX="5px">
          <Tooltip aria-label="server owner tooltip" label="Server owner">
            👑
          </Tooltip>
        </Box>
      ) : null}
    </Box>
  );
}
