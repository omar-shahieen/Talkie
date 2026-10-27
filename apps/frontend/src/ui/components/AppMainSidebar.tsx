import { Avatar, Box, Divider, Text, VStack } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddIcon } from '@chakra-ui/icons';
import {
  discoverPublicServers,
  fetchMyServers,
  fetchServers,
} from '../../app/services/server.service';
import { getAccessToken } from '../../app/authStorage';
import { useAuth } from '../../hooks/useAuth';
import { useThemedColors } from '../theme/colors';

export default function AppMainSidebar() {
  const colors = useThemedColors();
  const user = useAuth();
  const navigate = useNavigate();
  const [servers, setServers] = useState<any[]>([]);
  const logoSrc = '/talkie-logo.png';

  useEffect(() => {
    let isMounted = true;

    async function loadServers() {
      try {
        if (user?.id) {
          const mine = await fetchMyServers(user.id);
          const list =
            Array.isArray(mine) && mine.length > 0
              ? mine
              : await fetchServers();
          if (isMounted) {
            setServers(Array.isArray(list) ? list : []);
          }
          return;
        }

        if (getAccessToken()) {
          const list = await fetchServers();
          if (isMounted) {
            setServers(Array.isArray(list) ? list : []);
          }
          return;
        }

        const discovered = await discoverPublicServers({ limit: 20 });
        if (isMounted) {
          setServers(Array.isArray(discovered) ? discovered : []);
        }
      } catch {
        if (isMounted) {
          setServers([]);
        }
      }
    }

    void loadServers();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <Box
      width="100px"
      paddingX="5px"
      paddingTop="15px"
      overflowX="hidden"
      backgroundColor={colors.grayDarkest}
      display="flex"
      flexDirection="column"
      alignItems="center"
      overflowY="hidden"
    >
      <Avatar height="45px" width="45px" src={logoSrc} name="Talkie" />
      <Text
        marginTop="6px"
        color={colors.white}
        fontSize="xs"
        fontWeight="bold"
      >
        Talkie
      </Text>
      <Divider marginY="15px" width="30px" />
      <VStack spacing="10px" align="center" width="full">
        {servers.slice(0, 8).map((server, index) => (
          <Avatar
            key={server.id ?? `${server.name ?? 'server'}-${index}`}
            size="md"
            cursor="pointer"
            backgroundColor={colors.primary}
            color="white"
            src={server.icon || undefined}
            name={server.name}
            title={server.name}
          />
        ))}

        {user?.id && (
          <Box
            cursor="pointer"
            onClick={() => navigate('/settings')}
            display="flex"
            alignItems="center"
            justifyContent="center"
            width="45px"
            height="45px"
            borderRadius="50%"
            backgroundColor={colors.grayDark}
            _hover={{
              backgroundColor: 'green.500',
              color: 'white',
              borderRadius: '30%',
            }}
            color={colors.primary}
            transition="all 0.2s"
            title="Create a Server"
          >
            <AddIcon />
          </Box>
        )}
      </VStack>
    </Box>
  );
}
