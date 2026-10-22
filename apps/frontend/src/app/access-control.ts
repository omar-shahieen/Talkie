export function canEditMessage(
  currentUserId?: string | null,
  messageAuthorId?: string | null,
): boolean {
  return Boolean(
    currentUserId && messageAuthorId && currentUserId === messageAuthorId,
  );
}

export function canDeleteMessage(
  currentUserId?: string | null,
  messageAuthorId?: string | null,
): boolean {
  return canEditMessage(currentUserId, messageAuthorId);
}

const DELETE_FOR_EVERYONE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Returns true if the message is owned by the current user AND was
 * created within the last 24 hours (the "Delete for Everyone" window).
 */
export function canDeleteMessageForEveryone(
  currentUserId?: string | null,
  messageAuthorId?: string | null,
  messageCreatedAt?: string | Date | null,
): boolean {
  if (!canDeleteMessage(currentUserId, messageAuthorId)) {
    return false;
  }

  if (!messageCreatedAt) {
    return false;
  }

  const createdMs =
    typeof messageCreatedAt === 'string'
      ? new Date(messageCreatedAt).getTime()
      : messageCreatedAt.getTime();

  return Date.now() - createdMs <= DELETE_FOR_EVERYONE_WINDOW_MS;
}
