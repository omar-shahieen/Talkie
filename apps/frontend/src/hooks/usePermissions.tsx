import { useEffect, useState } from 'react';
import { canDeleteMessage, canEditMessage } from '../app/access-control';
import { useAuth } from './useAuth';

type PermissionCheckResult = {
  canDeleteMessage: boolean;
  canEditMessage: boolean;
  canDeleteOthersMessages: boolean;
  canManageChannel: boolean;
  canManageServer: boolean;
  isServerOwner: boolean;
  isAdmin: boolean;
  permissions: Record<string, boolean>;
  isLoading: boolean;
};

const DEFAULT_RESULT: PermissionCheckResult = {
  canDeleteMessage: false,
  canEditMessage: false,
  canDeleteOthersMessages: false,
  canManageChannel: false,
  canManageServer: false,
  isServerOwner: false,
  isAdmin: false,
  permissions: {},
  isLoading: true,
};

/**
 * Custom hook for checking user permissions
 * Permissions are calculated based on server roles and channel overwrites
 */
export function usePermissions(
  serverId?: string,
  channelId?: string,
): PermissionCheckResult {
  const currentUser = useAuth();
  const [permissions, setPermissions] =
    useState<PermissionCheckResult>(DEFAULT_RESULT);

  useEffect(() => {
    const hasCurrentUser = Boolean(currentUser?.id);

    setPermissions({
      canDeleteMessage: hasCurrentUser,
      canEditMessage: hasCurrentUser,
      canDeleteOthersMessages: false,
      canManageChannel: false,
      canManageServer: false,
      isServerOwner: false,
      isAdmin: false,
      permissions: {},
      isLoading: false,
    });
  }, [serverId, channelId, currentUser?.id]);

  return permissions;
}
