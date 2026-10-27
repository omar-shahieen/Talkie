import { Box, Text } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import AppCategoryChannelList from './AppCategoryChannelList';
import {
  discoverPublicServers,
  fetchMyServers,
  fetchServers,
} from '../../app/services/server.service';
import { useAuth } from '../../hooks/useAuth';
import { getAccessToken } from '../../app/authStorage';

export default function AppCategoryList() {
  const user = useAuth();
  const [servers, setServers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadServers() {
      try {
        setIsLoading(true);
        setErrorMessage('');

        if (!user?.id && !getAccessToken()) {
          const discovered = await discoverPublicServers({ limit: 20 });
          if (isMounted) {
            setServers(Array.isArray(discovered) ? discovered : []);
          }
          return;
        }

        const data = user?.id
          ? await fetchMyServers(user.id)
          : await discoverPublicServers({ limit: 20 });

        const fallbackData =
          Array.isArray(data) && data.length === 0
            ? await fetchServers()
            : data;

        if (isMounted) {
          setServers(Array.isArray(fallbackData) ? fallbackData : []);
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
        if (isMounted) {
          setErrorMessage('Unable to load servers.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadServers();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  if (isLoading) {
    return (
      <Box flexGrow={1} paddingTop="10px" paddingX="10px">
        <Text color="whiteAlpha.600" fontSize="sm">
          Loading servers...
        </Text>
      </Box>
    );
  }

  if (errorMessage) {
    return (
      <Box flexGrow={1} paddingTop="10px" paddingX="10px">
        <Text color="red.300" fontSize="sm">
          {errorMessage}
        </Text>
      </Box>
    );
  }

  if (!servers.length) {
    return (
      <Box flexGrow={1} paddingTop="10px" paddingX="10px">
        <Text color="whiteAlpha.600" fontSize="sm">
          No servers available.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexGrow={1}
      height="0px"
      display="flex"
      overflow="hidden"
      _hover={{
        overflowY: 'scroll',
      }}
      flexDirection="column"
      paddingTop="10px"
      paddingX="5px"
    >
      {servers.map((server, idx) => (
        <AppCategoryChannelList key={server.id || idx} server={server} />
      ))}
    </Box>
  );
}
