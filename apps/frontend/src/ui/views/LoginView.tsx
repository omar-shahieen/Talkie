import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  Heading,
  Image,
  Input,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { Redirect, useLocation } from 'react-router-dom';
import { getAccessToken } from '../../app/authStorage';
import {
  getGoogleAuthUrl,
  login,
  requestPasswordReset,
  signup,
  verifyTfa,
} from '../../app/services/auth-api.service';
import { resolveDefaultRedirectRoute } from '../../routes/defaultRoute';
import { useThemedColors } from '../theme/colors';

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

export default function LoginView() {
  const colors = useThemedColors();
  const toast = useToast();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(() => {
    const mode = new URLSearchParams(location.search).get('mode');
    return mode === 'signup' ? 'signup' : 'signin';
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [tfaLoginToken, setTfaLoginToken] = useState('');
  const [tfaToken, setTfaToken] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [postLoginRoute, setPostLoginRoute] = useState<string | null>(null);

  useEffect(() => {
    const pending = localStorage.getItem('pending_tfa_login_token');
    if (!pending) {
      return;
    }
    setAuthMode('signin');
    setTfaLoginToken(pending);
    setAuthStatus(
      'Two-factor authentication is required. Enter your 6-digit code.',
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    if (!token) {
      return;
    }

    resolveDefaultRedirectRoute().then((route) => {
      if (!cancelled && route !== '/login') {
        setPostLoginRoute(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (postLoginRoute) {
    return <Redirect to={postLoginRoute} />;
  }

  function loginWithGoogle() {
    window.location.href = getGoogleAuthUrl();
  }

  async function submitLogin() {
    if (!email || !password) {
      toast({
        title: 'Missing credentials',
        description: 'Enter email and password to sign in.',
        status: 'warning',
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    setIsSigningIn(true);
    setAuthStatus('');

    try {
      const data = await login({ email, password });

      if (data?.tfaRequired) {
        setTfaLoginToken(data?.tfaLoginToken ?? '');
        setAuthStatus(
          'Two-factor authentication is required. Enter your 6-digit code.',
        );
        return;
      }

      const accessToken = data?.access_token;
      if (!accessToken) {
        throw new Error('Missing access token in login response');
      }

      const payload = decodeJwtPayload(accessToken) as {
        sub?: string;
        email?: string;
      } | null;

      localStorage.setItem('access_token', accessToken);
      localStorage.removeItem('token');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: payload?.sub ?? '',
          email: payload?.email ?? email,
          name: (payload?.email ?? email).split('@')[0] || 'User',
          avatar: null,
        }),
      );

      const nextRoute = await resolveDefaultRedirectRoute();
      window.location.replace(nextRoute);
    } catch (error) {
      toast({
        title: 'Login failed',
        description:
          error instanceof Error ? error.message : 'Unable to sign in.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function submitTfa() {
    if (!tfaLoginToken || !tfaToken) {
      setAuthStatus('Enter the 6-digit TFA code.');
      return;
    }

    setIsSigningIn(true);
    setAuthStatus('');

    try {
      const data = await verifyTfa({ tfaToken, tfaLoginToken });

      const accessToken = data?.access_token;
      if (!accessToken) {
        throw new Error('Missing access token in TFA response');
      }

      const payload = decodeJwtPayload(accessToken) as {
        sub?: string;
        email?: string;
      } | null;

      localStorage.removeItem('pending_tfa_login_token');
      localStorage.setItem('access_token', accessToken);
      localStorage.removeItem('token');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: payload?.sub ?? '',
          email: payload?.email ?? email,
          name: (payload?.email ?? email).split('@')[0] || 'User',
          avatar: null,
        }),
      );

      setTfaLoginToken('');
      setTfaToken('');
      const nextRoute = await resolveDefaultRedirectRoute();
      window.location.replace(nextRoute);
    } catch (error) {
      setAuthStatus(
        error instanceof Error ? error.message : 'Unable to verify TFA.',
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  async function submitSignup() {
    if (!firstName || !lastName || !username || !email || !password || !passwordConfirm) {
      toast({
        title: 'Missing fields',
        description: 'Fill in all fields to create an account.',
        status: 'warning',
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    if (password !== passwordConfirm) {
      toast({
        title: 'Password mismatch',
        description: 'Password confirmation must match.',
        status: 'warning',
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    setIsSigningIn(true);

    try {
      await signup({
        firstName,
        lastName,
        email,
        username,
        password,
        passwordConfirm,
      });

      toast({
        title: 'Account created',
        description: 'Signing you in now.',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });

      await submitLogin();
    } catch (error) {
      toast({
        title: 'Signup failed',
        description:
          error instanceof Error ? error.message : 'Unable to create account.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function submitPasswordResetRequest() {
    if (!email) {
      toast({
        title: 'Missing email',
        description: 'Enter your email first.',
        status: 'warning',
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    try {
      await requestPasswordReset(email);

      toast({
        title: 'Recovery email sent',
        description: 'Check your inbox for the reset link.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Reset request failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to send recovery email.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      backgroundColor={colors.grayDarkest}
      padding="24px"
    >
      <Box
        width="100%"
        maxW="420px"
        backgroundColor={colors.grayMedium}
        borderRadius="12px"
        padding="28px"
        color={colors.white}
        boxShadow="xl"
      >
        <Box display="flex" flexDirection="column" alignItems="center" marginBottom="14px">
          <Image
            src="/talkie-logo.png"
            alt="Talkie logo"
            boxSize="72px"
            borderRadius="18px"
            objectFit="cover"
            marginBottom="10px"
          />
          <Heading size="lg" marginBottom="6px">
            Talkie
          </Heading>
          <Text color={colors.textDim} fontSize="sm" textAlign="center">
            {authMode === 'signin' ? 'Sign in to continue' : 'Create an account'}
          </Text>
        </Box>

        <ButtonGroup size="sm" marginBottom="20px" isAttached variant="outline">
          <Button
            flex="1"
            colorScheme={authMode === 'signin' ? 'blue' : 'gray'}
            onClick={() => {
              setAuthMode('signin');
              setAuthStatus('');
            }}
          >
            Sign in
          </Button>
          <Button
            flex="1"
            colorScheme={authMode === 'signup' ? 'blue' : 'gray'}
            onClick={() => {
              setAuthMode('signup');
              setAuthStatus('');
            }}
          >
            Sign up
          </Button>
        </ButtonGroup>

        {authStatus ? (
          <Text color="yellow.300" marginBottom="12px" fontSize="sm">
            {authStatus}
          </Text>
        ) : null}

        <VStack spacing="12px" align="stretch">
          {tfaLoginToken ? (
            <FormControl>
              <FormLabel>TFA Code</FormLabel>
              <Input
                value={tfaToken}
                onChange={(e) => setTfaToken(e.target.value)}
                placeholder="123456"
                backgroundColor={colors.darkLight}
              />
            </FormControl>
          ) : null}

          {authMode === 'signup' && !tfaLoginToken ? (
            <>
              <Box display="flex" gap="12px">
                <FormControl>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    backgroundColor={colors.darkLight}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    backgroundColor={colors.darkLight}
                  />
                </FormControl>
              </Box>
              <FormControl>
                <FormLabel>Username</FormLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  backgroundColor={colors.darkLight}
                />
              </FormControl>
            </>
          ) : null}

          {!tfaLoginToken ? (
            <>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  backgroundColor={colors.darkLight}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  backgroundColor={colors.darkLight}
                />
              </FormControl>
            </>
          ) : null}

          {authMode === 'signup' && !tfaLoginToken ? (
            <FormControl>
              <FormLabel>Confirm Password</FormLabel>
              <Input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                backgroundColor={colors.darkLight}
              />
            </FormControl>
          ) : null}
        </VStack>

        <ButtonGroup spacing={3} marginTop="20px" width="full" flexWrap="wrap">
          {tfaLoginToken ? (
            <Button variant="outline" onClick={() => setTfaLoginToken('')}>
              Back
            </Button>
          ) : authMode === 'signin' ? (
            <Button variant="ghost" onClick={submitPasswordResetRequest}>
              Forgot password
            </Button>
          ) : null}

          {!tfaLoginToken ? (
            <Button variant="outline" onClick={loginWithGoogle}>
              Google
            </Button>
          ) : null}

          {tfaLoginToken ? (
            <Button
              colorScheme="blue"
              onClick={submitTfa}
              isLoading={isSigningIn}
            >
              Verify TFA
            </Button>
          ) : authMode === 'signin' ? (
            <Button
              colorScheme="blue"
              onClick={submitLogin}
              isLoading={isSigningIn}
            >
              Sign In
            </Button>
          ) : (
            <Button
              colorScheme="blue"
              onClick={submitSignup}
              isLoading={isSigningIn}
            >
              Sign Up
            </Button>
          )}
        </ButtonGroup>
      </Box>
    </Box>
  );
}
