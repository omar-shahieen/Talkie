import { requestJson } from './api.service';

export type UserPayload = {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string | null;
  appRole?: 'admin' | 'user';
};

export async function fetchUsers(): Promise<UserPayload[]> {
  const data = await requestJson<unknown>('/users');
  if (Array.isArray(data)) {
    return data as UserPayload[];
  }

  if (Array.isArray((data as { data?: unknown[] } | null)?.data)) {
    return ((data as { data?: unknown[] }).data ?? []) as UserPayload[];
  }

  return [];
}

export async function fetchCurrentUser(): Promise<UserPayload | null> {
  const data = await requestJson<unknown>('/users/me');

  if (!data || typeof data !== 'object') {
    return null;
  }

  return data as UserPayload;
}

export async function searchUsers(query: string): Promise<UserPayload[]> {
  const data = await requestJson<unknown>('/users/search', {
    query: { q: query },
  });

  return Array.isArray(data) ? (data as UserPayload[]) : [];
}
