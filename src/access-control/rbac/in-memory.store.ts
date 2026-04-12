// src/permissions/in-memory.store.ts

import { Permission } from './permissions.constants';

export interface Role {
  id: string;
  serverId: string;
  name: string;
  position: number;
  permissions: bigint;
  isEveryone: boolean;
}

export interface ChannelOverwrite {
  channelId: string;
  targetId: string;
  targetType: 'role' | 'user';
  allow: bigint;
  deny: bigint;
}

export interface ServerMember {
  userId: string;
  serverId: string;
  roleIds: string[];
}

export interface Server {
  id: string;
  name: string;
  ownerId: string;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
}

// ─── Seed data ───────────────────────────────────────────────

export const servers: Server[] = [
  { id: 'server-1', name: 'NestJS Community', ownerId: 'user-owner' },
];

export const roles: Role[] = [
  {
    id: 'role-everyone',
    serverId: 'server-1',
    name: '@everyone',
    position: 0,
    permissions: Permission.ViewChannel | Permission.SendMessages,
    isEveryone: true,
  },
  {
    id: 'role-member',
    serverId: 'server-1',
    name: 'Member',
    position: 1,
    permissions: Permission.ViewChannel | Permission.SendMessages,
    isEveryone: false,
  },
  {
    id: 'role-moderator',
    serverId: 'server-1',
    name: 'Moderator',
    position: 2,
    permissions:
      Permission.ViewChannel |
      Permission.SendMessages |
      Permission.ManageMessages |
      Permission.KickMembers,
    isEveryone: false,
  },
  {
    id: 'role-admin',
    serverId: 'server-1',
    name: 'Admin',
    position: 3,
    permissions: Permission.Administrator,
    isEveryone: false,
  },
];

export const channels: Channel[] = [
  { id: 'channel-general', serverId: 'server-1', name: '#general' },
  { id: 'channel-announcements', serverId: 'server-1', name: '#announcements' },
  { id: 'channel-moderators', serverId: 'server-1', name: '#moderators-only' },
];

export const channelOverwrites: ChannelOverwrite[] = [
  // #announcements: everyone can VIEW but cannot SEND — moderators+ can send
  {
    channelId: 'channel-announcements',
    targetId: 'role-everyone',
    targetType: 'role',
    allow: 0n,
    deny: Permission.SendMessages,
  },
  {
    channelId: 'channel-announcements',
    targetId: 'role-moderator',
    targetType: 'role',
    allow: Permission.SendMessages,
    deny: 0n,
  },
  // #moderators-only: deny VIEW for @everyone, allow for moderator role
  {
    channelId: 'channel-moderators',
    targetId: 'role-everyone',
    targetType: 'role',
    allow: 0n,
    deny: Permission.ViewChannel | Permission.SendMessages,
  },
  {
    channelId: 'channel-moderators',
    targetId: 'role-moderator',
    targetType: 'role',
    allow: Permission.ViewChannel | Permission.SendMessages,
    deny: 0n,
  },
  // user-specific: user-silenced is denied SendMessages in #general
  {
    channelId: 'channel-general',
    targetId: 'user-silenced',
    targetType: 'user',
    allow: 0n,
    deny: Permission.SendMessages,
  },
];

export const members: ServerMember[] = [
  {
    userId: 'user-owner',
    serverId: 'server-1',
    roleIds: ['role-everyone', 'role-member'],
  },
  {
    userId: 'user-admin',
    serverId: 'server-1',
    roleIds: ['role-everyone', 'role-admin'],
  },
  {
    userId: 'user-moderator',
    serverId: 'server-1',
    roleIds: ['role-everyone', 'role-moderator'],
  },
  {
    userId: 'user-member',
    serverId: 'server-1',
    roleIds: ['role-everyone', 'role-member'],
  },
  {
    userId: 'user-silenced',
    serverId: 'server-1',
    roleIds: ['role-everyone', 'role-member'],
  },
];
