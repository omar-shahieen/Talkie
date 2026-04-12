// src/permissions/permissions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionsBitfield } from './permissions.bitfield';
import { Permission } from './permissions.constants';
import {
  servers,
  roles,
  channels,
  channelOverwrites,
  members,
  ChannelOverwrite,
} from './in-memory.store';

export interface ResolutionTrace {
  step: string;
  bits: string;
  grantedPermissions: string[];
}

export interface ResolutionResult {
  userId: string;
  serverId: string;
  channelId: string;
  allowed: boolean;
  finalPermissions: string[];
  trace: ResolutionTrace[];
}

@Injectable()
export class PermissionsService {
  resolve(
    userId: string,
    serverId: string,
    channelId: string,
  ): PermissionsBitfield {
    // REPLACE WITH REAL DB CALLS
    const server = servers.find((s) => s.id === serverId); // "DB_REPLACE"
    if (!server) throw new NotFoundException();
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) throw new NotFoundException();

    const member = members.find(
      (m) => m.userId === userId && m.serverId === serverId,
    );
    if (!member) throw new NotFoundException();

    const memberRoles = roles.filter((r) => member?.roleIds.includes(r.id));

    // Step 1 — owner bypass
    if (server.ownerId === userId) {
      return PermissionsBitfield.from(~0n);
    }

    // Step 2+3 — compute base permissions via bitwise OR of all roles
    let base = 0n;
    for (const role of memberRoles) {
      base |= role.permissions;
    }
    let perms = PermissionsBitfield.from(base);

    // Administrator bypass (checked after computing base)
    if (perms.has(Permission.Administrator)) {
      return PermissionsBitfield.from(~0n);
    }

    const overwrites = channelOverwrites.filter(
      (o) => o.channelId === channelId,
    );

    // Step 4 — @everyone channel overwrite
    const everyoneRole = memberRoles.find((r) => r.isEveryone);

    if (everyoneRole) {
      perms = this.applyOverwrite(perms, overwrites, everyoneRole.id, 'role');
    }

    // Step 5 — role overwrites (sorted by position ascending)
    const sortedRoles = [...memberRoles]
      .filter((r) => !r.isEveryone)
      .sort((a, b) => a.position - b.position);

    for (const role of sortedRoles) {
      perms = this.applyOverwrite(perms, overwrites, role.id, 'role');
    }

    // Step 6 — user-specific overwrite
    perms = this.applyOverwrite(perms, overwrites, userId, 'user');

    return perms;
  }

  private applyOverwrite(
    perms: PermissionsBitfield,
    overwrites: ChannelOverwrite[],
    targetId: string,
    targetType: 'role' | 'user',
  ): PermissionsBitfield {
    const overwrite = overwrites.find(
      (o) => o.targetId === targetId && o.targetType === targetType,
    );
    if (!overwrite) return perms;

    const allow = overwrite.allow;
    const deny = overwrite.deny;

    return perms.remove(deny).add(allow);
  }
}
