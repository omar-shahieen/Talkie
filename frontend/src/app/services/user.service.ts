import { requestJson } from './api.service';

type UserPayload = {
  id: string;
  email?: string;
  name?: string;
};

export async function fetchUsers(): Promise<UserPayload[]> {
  const data = await requestJson<unknown>('/users');
  return Array.isArray(data) ? (data as UserPayload[]) : [];
}
