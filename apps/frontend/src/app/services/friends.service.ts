import { requestJson } from './api.service';

export type FriendRequestPayload = {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
};

export type FriendshipPayload = {
  userId1: string;
  userId2: string;
  createdAt?: string;
};

export async function sendFriendRequest(receiverId: string) {
  return requestJson<FriendRequestPayload>('/friendRequests', {
    method: 'POST',
    body: { receiverId },
  });
}

export async function acceptFriendRequest(requestId: string) {
  return requestJson(`/friendRequests/${requestId}/accept`, {
    method: 'PATCH',
  });
}

export async function rejectFriendRequest(requestId: string) {
  return requestJson(`/friendRequests/${requestId}/reject`, {
    method: 'PATCH',
  });
}

export async function cancelFriendRequest(requestId: string) {
  return requestJson(`/friendRequests/${requestId}`, {
    method: 'DELETE',
  });
}

export async function fetchIncomingFriendRequests() {
  const data = await requestJson<unknown>('/friendRequests/incoming');
  return Array.isArray(data) ? (data as FriendRequestPayload[]) : [];
}

export async function fetchOutgoingFriendRequests() {
  const data = await requestJson<unknown>('/friendRequests/outgoing');
  return Array.isArray(data) ? (data as FriendRequestPayload[]) : [];
}

export async function fetchFriends() {
  const data = await requestJson<unknown>('/friends');
  return Array.isArray(data) ? (data as FriendshipPayload[]) : [];
}

export async function unfriend(targetId: string) {
  return requestJson(`/friends/${targetId}`, {
    method: 'DELETE',
  });
}
