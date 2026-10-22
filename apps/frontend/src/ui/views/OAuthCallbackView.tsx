import React, { useEffect } from 'react';
import { Box, Spinner, Text } from '@chakra-ui/react';
import { resolveDefaultRedirectRoute } from '../../routes/defaultRoute';

function decodeJwtPayload(token: string) {
  const payloadPart = token.split('.')[1];
  if (!payloadPart) {
    return null;
  }

  const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export default function OAuthCallbackView() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const tfaRequired = params.get('tfaRequired');
    const tfaLoginToken = params.get('tfaLoginToken');

    async function completeOAuth() {
      if (token) {
        localStorage.setItem('access_token', token);
        localStorage.removeItem('token');
        localStorage.removeItem('pending_tfa_login_token');
        const payload = decodeJwtPayload(token) as {
          sub?: string;
          email?: string;
        } | null;

        if (payload?.sub) {
          localStorage.setItem(
            'user',
            JSON.stringify({
              id: payload.sub,
              email: payload.email ?? '',
              name: (payload.email ?? 'User').split('@')[0],
              avatar: null,
            }),
          );
        }

        window.location.replace(await resolveDefaultRedirectRoute());
        return;
      }

      if (tfaRequired === '1' && tfaLoginToken) {
        localStorage.setItem('pending_tfa_login_token', tfaLoginToken);
        window.location.replace(await resolveDefaultRedirectRoute());
        return;
      }

      window.location.replace('/login');
    }

    void completeOAuth();
  }, []);

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      gap="14px"
      backgroundColor="#1f2127"
      color="white"
    >
      <Spinner thickness="3px" speed="0.7s" />
      <Text>Completing sign in...</Text>
    </Box>
  );
}
