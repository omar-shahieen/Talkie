import { Avatar } from '@chakra-ui/avatar';
import { Box, Divider, Text, VStack } from '@chakra-ui/layout';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../app/supabase';
import { colors } from '../theme/colors';

export default function AppMainSidebar() {
  const [servers, setServers] = useState<any[]>([]);
  const logoSrc = '/talkie-logo.png';

  useEffect(() => {
    let isMounted = true;

    supabase.from('servers').then((res: any) => {
      if (!isMounted) {
        return;
      }

      setServers(Array.isArray(res?.data) ? res.data : []);
    });

    return () => {
      isMounted = false;
    };
  }, []);

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
      <Text marginTop="6px" color="white" fontSize="xs" fontWeight="bold">
        Talkie
      </Text>
      <Divider marginY="15px" width="30px" />
      <VStack spacing="10px" align="center" width="full">
        {servers.slice(0, 8).map((server, index) => (
          <Avatar
            key={server.id ?? `${server.name ?? 'server'}-${index}`}
            size="md"
            cursor="pointer"
            backgroundColor="transparent"
            src={server.icon || undefined}
            name={server.name}
            title={server.name}
          />
        ))}

        {!servers.length && (
          <>
            <Avatar size="md" cursor="pointer" name="" />
            <Avatar size="md" cursor="pointer" name="" />
            <Avatar size="md" cursor="pointer" name="" />
            <Avatar size="md" cursor="pointer" name="" />
          </>
        )}
      </VStack>
    </Box>
  );
}
