import { requestJson } from './api.service';

export type RoleRecord = {
  id: string;
  name: string;
  serverId: string;
  position: number;
  permissions: string;
  isEveryone: boolean;
};

export async function fetchRoles() {
  const data = await requestJson<unknown>('/roles');
  return Array.isArray(data) ? (data as RoleRecord[]) : [];
}

export async function createRole(payload: {
  name: string;
  serverId: string;
  position?: number;
  permissions?: string;
  isEveryone?: boolean;
}): Promise<RoleRecord> {
  return requestJson<RoleRecord>('/roles', {
    method: 'POST',
    body: payload,
  });
}

export async function updateRole(
  id: string,
  payload: Partial<{
    name: string;
    position: number;
    permissions: string;
    isEveryone: boolean;
  }>,
) {
  return requestJson<RoleRecord>(`/roles/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteRole(id: string) {
  return requestJson(`/roles/${id}`, {
    method: 'DELETE',
  });
}
