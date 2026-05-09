import {
  ChevronDownIcon,
  InfoOutlineIcon,
  RepeatIcon,
  SettingsIcon,
} from '@chakra-ui/icons';
import {
  Avatar,
  Box,
  Button,
  Center,
  ButtonGroup,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router';
import { supabase, getChatSocket } from '../../app/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  DEFAULT_REDIRECT_ROUTE,
  OTHER_REDIRECT_ROUTE,
} from '../../routes/AppRouteProvider';
import { colors } from '../theme/colors';
import AppCategoryList from './AppCategoryList';
import AppIconButton from './AppIconButton';
import {
  getGoogleAuthUrl,
  login,
  logoutApi,
  requestPasswordReset,
  signup,
  verifyTfa,
} from '../../app/services/auth-api.service';
import talkieLogo from '../../logo.svg';

function useBrandLogo(defaultSvg: string) {
  // Prefer the raster logo placed in public at runtime.
  return '/talkie-logo.png';
}

function LogoAvatar(props: { size?: any }) {
  const logo = useBrandLogo(talkieLogo);
  return <Avatar src={logo} name="Talkie" {...props} />;
}

export default function AppLeftSidebar() {
  return (
    <Box
      width="300px"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      backgroundColor={colors.grayMedium}
    >
      <AppLeftSidebarTopbar />

      <AppCategoryList />

      <BottomSection />
    </Box>
  );
}

function AppLeftSidebarTopbar() {
  const history = useHistory();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [tfaLoginToken, setTfaLoginToken] = useState('');
  const [tfaToken, setTfaToken] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

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

  async function loginWithEmail() {}

  function openSignIn() {
    setAuthMode('signin');
    onOpen();
  }

  function openSignUp() {
    setAuthMode('signup');
    onOpen();
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

      onClose();
      window.location.reload();
      <Avatar
        src={user?.avatar ?? undefined}
        size="sm"
        name={user?.name ?? 'Guest'}
      />;
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
      onClose();
      window.location.reload();
    } catch (error) {
      setAuthStatus(
        error instanceof Error ? error.message : 'Unable to verify TFA.',
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  async function submitSignup() {
    if (!firstName || !username || !email || !password || !passwordConfirm) {
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
        lastName: '',
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

  async function logout() {
    await supabase.auth.signOut();
    history.replace(DEFAULT_REDIRECT_ROUTE);
    window.location.reload();
  }

  return (
    <Box
      height="50px"
      display="flex"
      justifyContent="center"
      alignItems="center"
      paddingX="5px"
      backgroundColor={colors.grayMedium}
      borderBottomColor="gray"
      borderBottomWidth="1px"
    >
      <Menu>
        <MenuButton
          as={Button}
          color="white"
          width="full"
          backgroundColor="transparent"
          rightIcon={<ChevronDownIcon />}
          _hover={{ background: 'none' }}
          _active={{ background: 'none' }}
        >
          <HStack maxW="225px" spacing="8px">
            <LogoAvatar size="xs" />
            <Text isTruncated>Talkie</Text>
          </HStack>
        </MenuButton>
        <MenuList>
          <MenuItem onClick={openSignIn}>Sign In</MenuItem>
          <MenuItem onClick={openSignUp}>Sign Up</MenuItem>
          <MenuItem onClick={logout}>Logout</MenuItem>
        </MenuList>
      </Menu>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {authStatus ? (
              <Text color="yellow.300" marginBottom="12px" fontSize="sm">
                {authStatus}
              </Text>
            ) : null}

            {tfaLoginToken ? (
              <FormControl marginBottom="12px">
                <FormLabel>TFA Code</FormLabel>
                <Input
                  value={tfaToken}
                  onChange={(event) => setTfaToken(event.target.value)}
                  placeholder="123456"
                />
              </FormControl>
            ) : null}

            {authMode === 'signup' && (
              <>
                <FormControl marginBottom="12px">
                  <FormLabel>First Name</FormLabel>
                  <Input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Carlo"
                  />
                </FormControl>

                <FormControl marginBottom="12px">
                  <FormLabel>Username</FormLabel>
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="carlomigueldy"
                  />
                </FormControl>
              </>
            )}

            <FormControl marginBottom="12px">
              <FormLabel>Email</FormLabel>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </FormControl>

            {authMode === 'signup' && (
              <FormControl marginTop="12px">
                <FormLabel>Confirm Password</FormLabel>
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder="••••••••"
                />
              </FormControl>
            )}
          </ModalBody>

          <ModalFooter>
            <Button mr={3} onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <ButtonGroup spacing={3}>
              {tfaLoginToken ? (
                <Button variant="outline" onClick={() => setTfaLoginToken('')}>
                  Back
                </Button>
              ) : authMode === 'signin' ? (
                <Button variant="ghost" onClick={submitPasswordResetRequest}>
                  Forgot password
                </Button>
              ) : null}

              {!tfaLoginToken && (
                <Button variant="outline" onClick={loginWithGoogle}>
                  Google
                </Button>
              )}

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
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

function BottomSection() {
  const user = useAuth();
  const history = useHistory();
  const [presenceStatus, setPresenceStatus] = useState<
    'online' | 'dnd' | 'idle' | 'offline'
  >('online');

  function toSettingsView() {
    history.push('/settings');
  }

  function toOther() {
    history.push(OTHER_REDIRECT_ROUTE);
  }

  function logout() {
    // Clear auth tokens and user data
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    void logoutApi().catch((err) => console.log('Logout cleanup:', err));

    // Redirect to home
    history.push(DEFAULT_REDIRECT_ROUTE);
  }

  function setPresence(status: 'online' | 'dnd' | 'idle' | 'offline') {
    setPresenceStatus(status);

    const socket = getChatSocket();
    if (socket) {
      socket.emit('presence:set', { status });
    }
  }

  console.log('[useAuth]', user);

  const statusColors: Record<string, string> = {
    online: '#43b581',
    dnd: '#f04747',
    idle: '#faa61a',
    offline: '#747f8d',
  };

  const statusEmoji: Record<string, string> = {
    online: '🟢',
    dnd: '🔴',
    idle: '🟡',
    offline: '⚫',
  };

  return (
    <Box
      paddingY="12px"
      paddingX="5px"
      display="flex"
      justifyContent="center"
      alignItems="center"
      backgroundColor={colors.grayDark}
    >
      <Center>
        <LogoAvatar size="sm" />
      </Center>
      <Box marginX="10px">
        <Text color="white" maxW="100px" fontSize="sm" isTruncated>
          {user?.email ?? 'Guest'}
        </Text>

        <Text color="gray.500" fontSize="xs">
          {statusEmoji[presenceStatus]} {presenceStatus}
        </Text>
      </Box>
      <HStack>
        <AppIconButton
          ariaLabel="Mute mic"
          icon={<InfoOutlineIcon />}
        ></AppIconButton>
        <AppIconButton
          ariaLabel="To other"
          tooltip="Other"
          icon={<RepeatIcon />}
          onClick={toOther}
        ></AppIconButton>
        <AppIconButton
          ariaLabel="Settings"
          tooltip="Settings"
          icon={<SettingsIcon />}
          onClick={toSettingsView}
        ></AppIconButton>
        <Menu>
          <MenuButton
            as={Button}
            backgroundColor="transparent"
            color="white"
            padding="0"
            minWidth="auto"
            height="auto"
            _hover={{ background: 'none' }}
            _active={{ background: 'none' }}
          >
            <ChevronDownIcon />
          </MenuButton>
          <MenuList bg={colors.darkMedium} border="none">
            <MenuItem
              bg={colors.darkMedium}
              _hover={{ bg: 'gray.600' }}
              onClick={() => setPresence('online')}
            >
              🟢 Online
            </MenuItem>
            <MenuItem
              bg={colors.darkMedium}
              _hover={{ bg: 'gray.600' }}
              onClick={() => setPresence('dnd')}
            >
              🔴 Do Not Disturb
            </MenuItem>
            <MenuItem
              bg={colors.darkMedium}
              _hover={{ bg: 'gray.600' }}
              onClick={() => setPresence('idle')}
            >
              🟡 Away
            </MenuItem>
            <MenuItem
              bg={colors.darkMedium}
              _hover={{ bg: 'gray.600' }}
              onClick={() => setPresence('offline')}
            >
              ⚫ Offline
            </MenuItem>
            <MenuItem
              bg={colors.darkMedium}
              _hover={{ bg: 'gray.600' }}
              onClick={logout}
              color="red.300"
            >
              🚪 Logout
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Box>
  );
}
