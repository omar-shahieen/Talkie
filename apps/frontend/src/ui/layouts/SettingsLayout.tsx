import { CloseIcon } from "@chakra-ui/icons";
import { Box, Divider, Link, Text, IconButton } from "@chakra-ui/react";
import React from "react";
import { Link as RouterLink, useHistory } from "react-router-dom";
import { useThemedColors } from "../theme/colors";
import { supabase } from "../../app/supabase";

export type SettingsLayoutProps = {
  children: React.ReactNode;
};

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const colors = useThemedColors();
  const history = useHistory();

  return (
    <Box display="flex" height="100vh">
      <SettingsLeftSidebar />
      <Box
        flex="2"
        height="100%"
        backgroundColor={colors.grayLight}
        overflowY="scroll"
        paddingX="30px"
        paddingY="50px"
        color={colors.dark}
        position="relative"
      >
        <Box position="absolute" top="20px" right="30px">
          <IconButton
            aria-label="Close Settings"
            icon={<CloseIcon />}
            variant="ghost"
            color="gray.400"
            _hover={{ color: colors.dark, backgroundColor: 'whiteAlpha.200' }}
            onClick={() => history.push('/')}
          />
        </Box>
        {children}
      </Box>
    </Box>
  );
}

function SettingsLeftSidebar() {
  const colors = useThemedColors();
  const history = useHistory();
  return (
    <Box
      flex="1"
      display="flex"
      justifyContent="flex-end"
      alignItems="start"
      height="100%"
      backgroundColor={colors.grayDark}
      paddingY="50px"
      paddingX="15px"
      overflow="hidden"
      _hover={{
        overflowY: "scroll",
      }}
    >
      <Box display="flex" flexDirection="column">
        <SettingsListHeader>User Settings</SettingsListHeader>

        <SettingsListItem label="My Account" active />
        <Link as={RouterLink} to="/settings/admin" _hover={{ textDecoration: 'none' }}>
          <SettingsListItem label="Admin Management" />
        </Link>

        <AppSettingsDivider />

        <SettingsListItem
          color="red.600"
          hoverBackgroundColor="red.900"
          onClick={async () => {
            await supabase.auth.signOut();
            history.replace('/login');
            window.location.reload();
          }}
        >
          Log Out
        </SettingsListItem>
      </Box>
    </Box>
  );
}

type SettingsListItemProps = {
  label?: string;
  active?: boolean;
  children?: React.ReactNode;
  color?: string;
  hoverBackgroundColor?: string;
  onClick?: () => void;
};

function SettingsListItem({
  active,
  label,
  color,
  hoverBackgroundColor,
  onClick,
  children,
}: SettingsListItemProps) {
  const colors = useThemedColors();
  return (
    <Box
      onClick={onClick}
      paddingX="5px"
      paddingRight="100px"
      paddingY="5px"
      marginY="2px"
      borderRadius="sm"
      cursor="pointer"
      color={!!color ? color : active ? colors.dark : "whiteAlpha.500"}
      backgroundColor={active ? colors.lightGray : "transparent"}
      _hover={{
        backgroundColor: !!hoverBackgroundColor
          ? hoverBackgroundColor
          : colors.grayLight,
      }}
    >
      <Text>{!!label ? label : children}</Text>
    </Box>
  );
}

type SettingsListHeaderProps = {
  children?: React.ReactNode;
};

function SettingsListHeader({ children }: SettingsListHeaderProps) {
  return (
    <Text
      color="gray"
      fontWeight="bold"
      textTransform="uppercase"
      fontSize="xs"
      marginY="5px"
    >
      {children}
    </Text>
  );
}

function AppSettingsDivider() {
  return (
    <Box>
      <Divider marginY="15px" />
    </Box>
  );
}
