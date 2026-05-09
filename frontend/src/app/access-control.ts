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
