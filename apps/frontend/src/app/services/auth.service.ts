import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '../authStorage';

export { clearAccessToken, getAccessToken, setAccessToken };

export function hasAuthToken(): boolean {
  return Boolean(getAccessToken());
}
