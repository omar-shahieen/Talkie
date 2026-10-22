import { requestJson } from './api.service';

export async function resolveAppAccess() {
  return requestJson<{ message: string }>('/access-control/resolveApp');
}

export async function resolveServerAccess(userId: string, serverId: string) {
  return requestJson<{ message: string }>(
    `/access-control/resolveServer/${userId}/${serverId}`,
  );
}
