import { requestJson } from './api.service';

export type NotificationRecord = {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  created_at: string;
  link?: string;
};

type ApiNotification = Record<string, any>;

function normalizeNotification(record: ApiNotification): NotificationRecord {
  return {
    id: record.id,
    title: record.title || 'Notification',
    content: record.content || record.message || '',
    isRead: Boolean(record.isRead || record.read),
    created_at: record.created_at || record.createdAt || new Date().toISOString(),
    link: record.link,
  };
}

export async function fetchNotifications() {
  const data = await requestJson<unknown>('/notifications');
  const records = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown[] } | null)?.data)
      ? ((data as { data?: unknown[] }).data ?? [])
      : [];

  return records.map((record) =>
    normalizeNotification(record as ApiNotification),
  );
}

export async function markNotificationAsRead(notificationId: string) {
  return requestJson(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}
