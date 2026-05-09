import { ChevronRightIcon } from "@chakra-ui/icons";
import { Box, Text } from "@chakra-ui/layout";
import React, { useEffect, useState } from "react";
import { useHistory } from "react-router";
import AppChannelListItem from "./AppChannelListItem";

type AppCategoryChannelListProps = {
  server?: any;
};

export default function AppCategoryChannelList({ server }: AppCategoryChannelListProps) {
  const [channels, setChannels] = useState<any[]>([]);
  const history = useHistory();

  useEffect(() => {
    // If server has channels, use them; otherwise use placeholder
    if (server?.id) {
      const serverChannels = server.channels || [];
      setChannels(serverChannels);
    }
  }, [server]);

  // Fallback to placeholder channels if no real server
  const displayChannels = channels.length > 0 ? channels : [
    { id: 'ch-1', name: 'general', icon: '💬' },
    { id: 'ch-2', name: 'announcement', icon: '🎙️' },
    { id: 'ch-3', name: 'tasks', icon: '🔵' },
    { id: 'ch-4', name: 'guide', icon: '🧰' },
    { id: 'ch-5', name: 'help', icon: '🤯' },
  ];

  const serverName = server?.name || '🛫 Main';

  const handleChannelClick = (channelId: string) => {
    if (server?.id) {
      history.push(`/servers/${server.id}/channels/${channelId}`);
    }
  };

  return (
    <Box marginY="5px">
      <Text color="white" fontSize="xs" fontWeight="bold" marginBottom="5px">
        <ChevronRightIcon /> {serverName.toUpperCase()}
      </Text>
      {displayChannels.map((channel, idx) => (
        <AppChannelListItem
          key={channel.id || idx}
          label={`${channel.icon || '💬'}-${channel.name || `channel-${idx}`}`}
          active={idx === 0}
          onClick={() => handleChannelClick(channel.id)}
        />
      ))}
    </Box>
  );
}
