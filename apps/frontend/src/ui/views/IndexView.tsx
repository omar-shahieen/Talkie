import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppChatContainer from '../components/AppChatContainer';
import { acknowledgeChannel } from '../../app/services/channel.service';
import { fetchMessages } from '../../app/services/message.service';

function IndexView() {
  const { serverId = '', channelId = '' } = useParams<{
    serverId: string;
    channelId: string;
  }>();

  useEffect(() => {
    if (!channelId) {
      return;
    }

    let isMounted = true;

    async function acknowledgeLatestChannelMessage() {
      try {
        const messages = await fetchMessages(channelId);
        const latestMessageId =
          messages.length > 0
            ? messages[messages.length - 1].id
            : null;

        if (!isMounted || !latestMessageId) {
          return;
        }

        await acknowledgeChannel(channelId, latestMessageId);
      } catch (err) {
        console.error('Error acknowledging channel:', err);
      }
    }

    void acknowledgeLatestChannelMessage();

    return () => {
      isMounted = false;
    };
  }, [channelId]);

  if (!serverId || !channelId) {
    return null;
  }

  return (
    <>
      <AppChatContainer serverId={serverId} channelId={channelId} />
    </>
  );
}

export default IndexView;
