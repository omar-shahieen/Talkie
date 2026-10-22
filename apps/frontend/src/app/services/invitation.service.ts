import { requestJson } from './api.service';

export type InvitationPayload = {
  inviteCode?: string;
  serverId?: string;
  inviterId?: string;
  icon?: string;
  name?: string;
  memberCount?: number;
  expiresAt?: string | null;
};

export async function resolveInvitation(inviteCode: string) {
  return requestJson<InvitationPayload>(`/invitations/${inviteCode}`);
}

export async function acceptInvitation(inviteCode: string) {
  return requestJson(`/invitations/${inviteCode}/accept`, {
    method: 'POST',
  });
}

export async function removeInvitation(inviteCode: string) {
  return requestJson(`/invitations/${inviteCode}`, {
    method: 'DELETE',
  });
}
