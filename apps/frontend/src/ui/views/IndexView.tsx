import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { Route, Switch } from 'react-router-dom';
import { supabase } from '../../app/supabase';
import AppChatContainer from '../components/AppChatContainer';
import { acknowledgeChannel } from '../../app/services/channel.service';

function IndexView() {
  const { serverId, channelId } = useParams<{
    serverId: string;
    channelId: string;
  }>();

  useEffect(() => {
    if (!channelId) {
      return;
    }

    let isMounted = true;

    async function acknowledgeLatestChannelMessage() {
      const { data } = await supabase
        .from(`messages:channel_id=eq.${channelId}`)
        .select('*')
        .limit(1)
        .order('created_at', { ascending: false });

      const latestMessageId = data?.[0]?.id;
      if (!isMounted || !latestMessageId) {
        return;
      }

      await acknowledgeChannel(channelId, latestMessageId);
    }

    void acknowledgeLatestChannelMessage();

    return () => {
      isMounted = false;
    };
  }, [channelId]);

  return (
    <>
      <Switch>
        <Route path="/">
          <AppChatContainer serverId={serverId} channelId={channelId} />
        </Route>
      </Switch>
    </>
  );
}

export default IndexView;
