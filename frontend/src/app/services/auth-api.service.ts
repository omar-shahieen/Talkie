import { buildApiUrl, requestJson } from './api.service';

export function getGoogleAuthUrl(): string {
  return buildApiUrl('/auth/google');
}

export async function login(payload: { email: string; password: string }) {
  return requestJson<{
    tfaRequired?: boolean;
    tfaLoginToken?: string;
    access_token?: string;
  }>('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export async function verifyTfa(payload: {
  tfaToken: string;
  tfaLoginToken: string;
}) {
  return requestJson<{ access_token?: string }>('/auth/tfa/verify', {
    method: 'POST',
    token: payload.tfaLoginToken,
    body: { tfaToken: payload.tfaToken },
  });
}

export async function signup(payload: {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  passwordConfirm: string;
}) {
  return requestJson('/auth/signup', {
    method: 'POST',
    body: payload,
  });
}

export async function requestPasswordReset(email: string) {
  return requestJson('/auth/forget-passwrod', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPassword(payload: {
  newPassword: string;
  resetToken: string;
}) {
  return requestJson('/auth/reset-passwrod', {
    method: 'POST',
    body: payload,
  });
}

export async function changePassword(payload: {
  oldPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}) {
  return requestJson('/auth/change-password', {
    method: 'PUT',
    body: payload,
  });
}

export async function initiateTfa() {
  return requestJson<{ uri?: string }>('/auth/tfa/initiate', {
    method: 'POST',
  });
}

export async function setTfa(mode: 'enable' | 'disable', tfaToken: string) {
  return requestJson(`/auth/tfa/${mode}`, {
    method: 'POST',
    body: { tfaToken },
  });
}

export async function logoutApi() {
  return requestJson('/auth/logout', {
    method: 'POST',
  });
}
