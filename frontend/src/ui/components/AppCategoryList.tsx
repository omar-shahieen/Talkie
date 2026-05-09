import { Box } from '@chakra-ui/layout';
import React, { useEffect, useState } from 'react';
import AppCategoryChannelList from './AppCategoryChannelList';
import { fetchServers } from '../../app/services/server.service';

export default function AppCategoryList() {
  const [servers, setServers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadServers() {
      try {
        setIsLoading(true);
        const data = await fetchServers();
        if (isMounted) {
          setServers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
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
  }, []);

  // Fallback to placeholder if no servers loaded
  const displayServers = servers.length > 0 ? servers : [{}, {}, {}, {}];

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
      {displayServers.map((server, idx) => (
        <AppCategoryChannelList key={server.id || idx} server={server} />
      ))}
    </Box>
  );
}
