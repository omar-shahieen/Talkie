import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Button, Input, Text } from '@chakra-ui/react';
import { resetPassword } from '../../app/services/auth-api.service';

export default function ResetPasswordView() {
  const location = useLocation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') ?? '';
  }, [location.search]);

  async function submitResetPassword() {
    if (!resetToken) {
      setStatus('Missing reset token.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setStatus('Enter and confirm the new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setStatus('');

    try {
      await resetPassword({
        newPassword,
        newPasswordConfirm: confirmPassword,
        resetToken,
      });

      setStatus('Password updated successfully. You can sign in now.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Unable to reset password.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      backgroundColor="#1c1c1c"
      padding="24px"
    >
      <Box
        width="100%"
        maxW="420px"
        backgroundColor="#2e2d2d"
        borderRadius="12px"
        padding="24px"
        color="white"
      >
        <Text fontSize="2xl" fontWeight="bold" marginBottom="16px">
          Reset Password
        </Text>

        <Text marginBottom="16px" color="whiteAlpha.700">
          Enter a new password for your account.
        </Text>

        <Input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          marginBottom="12px"
        />
        <Input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          marginBottom="16px"
        />

        {status ? (
          <Text marginBottom="16px" color="yellow.300" fontSize="sm">
            {status}
          </Text>
        ) : null}

        <Button
          colorScheme="blue"
          width="full"
          onClick={submitResetPassword}
          isLoading={isSubmitting}
        >
          Update Password
        </Button>
      </Box>
    </Box>
  );
}
