export function getAccessToken(): string | null {
  try {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      return accessToken;
    }

    const legacyToken = localStorage.getItem('token');
    if (legacyToken) {
      localStorage.setItem('access_token', legacyToken);
      localStorage.removeItem('token');
      return legacyToken;
    }

    return null;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string) {
  localStorage.setItem('access_token', token);
  localStorage.removeItem('token');
}

export function clearAccessToken() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
}
