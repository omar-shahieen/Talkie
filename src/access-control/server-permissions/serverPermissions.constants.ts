export const Permission = {
  ViewChannel: 1n << 0n,
  SendMessages: 1n << 1n,
  ManageMessages: 1n << 2n,
  ManageChannels: 1n << 3n,
  ManageRoles: 1n << 4n,
  KickMembers: 1n << 5n,
  BanMembers: 1n << 6n,
  Administrator: 1n << 7n,
} as const;

export type ServerPermissionKey = keyof typeof Permission;
