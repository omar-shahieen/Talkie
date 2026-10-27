export { AuditLog } from '../../audit/auditLog.entity';
export { Channel, ChannelType } from '../../channels/entities/channel.entity';
export { ChannelMember } from '../../channels/entities/channel-member.entity';
export { ChannelOverwrite } from '../../channels/entities/channel-overwrite.entity';
export { ReadState } from '../../channels/entities/readState.entity';
export { Invitation } from '../../invitations/entities/invitation.entity';
export { Message } from '../../messages/entities/message.entity';
export { MessageAttachment } from '../../messages/entities/message-attachment.entity';
export { MessageReaction } from '../../messages/entities/message-reaction.entity';
export {
  Notification,
  NotificationType,
} from '../../notifications/entities/notification.entity';
export { Role } from '../../roles/entities/role.entity';
export { Server } from '../../servers/entities/server.entity';
export { ServerMember } from '../../servers/entities/server-member.entity';
export { AppRole, User } from '../../users/entities/user.entity';

export const FULL_SCHEMA_DESIGN = {
  enums: {
    AppRole: ['user', 'admin'],
    ChannelType: ['SERVER_TEXT', 'SERVER_VOICE', 'DM'],
    NotificationType: ['DM', 'mention', 'friend_request', 'other'],
  },
  entities: [
    {
      entity: 'AuditLog',
      table: 'auditLog',
      source: 'src/audit/auditLog.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'action', type: 'varchar' },
        { name: 'payload', type: 'jsonb' },
      ],
    },
    {
      entity: 'User',
      table: 'users',
      source: 'src/users/entities/user.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'firstName', type: 'varchar', nullable: true },
        { name: 'lastName', type: 'varchar', nullable: true },
        { name: 'email', type: 'varchar', unique: true },
        { name: 'username', type: 'varchar', unique: true },
        { name: 'password', type: 'varchar', nullable: true, select: false },
        {
          name: 'googleId',
          type: 'varchar',
          nullable: true,
          unique: true,
          select: false,
        },
        {
          name: 'currentJwtToken',
          type: 'varchar',
          nullable: true,
          unique: true,
          select: false,
        },
        { name: 'isTfaEnabled', type: 'boolean', default: false },
        { name: 'tfaSecret', type: 'varchar', nullable: true, select: false },
        {
          name: 'status_preference',
          type: 'enum',
          nullable: true,
          values: ['online', 'dnd'],
        },
        { name: 'dnd_until', type: 'timestamp', nullable: true },
        {
          name: 'appRole',
          type: 'enum',
          default: 'user',
          values: ['user', 'admin'],
          select: false,
        },
        { name: 'createdAt', type: 'timestamp', createdAt: true },
        { name: 'updatedAt', type: 'timestamp', updatedAt: true },
        { name: 'deletedAt', type: 'timestamp', deletedAt: true },
      ],
    },
    {
      entity: 'Server',
      table: 'servers',
      source: 'src/servers/entities/server.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'name', type: 'varchar' },
        { name: 'ownerId', type: 'varchar' },
        { name: 'isPublic', type: 'boolean', default: false },
        { name: 'icon', type: 'varchar', default: '' },
        { name: 'description', type: 'varchar', nullable: true },
        { name: 'category', type: 'varchar', nullable: true },
        { name: 'tags', type: 'simple-array', nullable: true },
      ],
      relations: [
        { kind: 'one-to-many', target: 'Role', inverse: 'server' },
        { kind: 'one-to-many', target: 'Channel', inverse: 'server' },
        { kind: 'one-to-many', target: 'ServerMember', inverse: 'server' },
        { kind: 'one-to-many', target: 'Invitation', inverse: 'server' },
      ],
    },
    {
      entity: 'ServerMember',
      table: 'server_members',
      source: 'src/servers/entities/server-member.entity.ts',
      columns: [
        { name: 'memberId', type: 'uuid', primary: true },
        { name: 'serverId', type: 'uuid', primary: true },
      ],
      relations: [
        { kind: 'many-to-one', target: 'Server', inverse: 'members' },
        {
          kind: 'many-to-many',
          target: 'Role',
          joinTable: 'member_roles',
          joinColumns: ['memberId', 'serverId'],
          inverseJoinColumns: ['roleId'],
        },
      ],
    },
    {
      entity: 'Role',
      table: 'roles',
      source: 'src/roles/entities/role.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'name', type: 'varchar' },
        { name: 'position', type: 'int', default: 0 },
        { name: 'permissions', type: 'varchar', length: 20, default: '0' },
        { name: 'isEveryone', type: 'boolean', default: false },
        { name: 'serverId', type: 'varchar' },
      ],
      relations: [{ kind: 'many-to-one', target: 'Server', inverse: 'roles' }],
    },
    {
      entity: 'Channel',
      table: 'channels',
      source: 'src/channels/entities/channel.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        {
          name: 'type',
          type: 'enum',
          default: 'SERVER_TEXT',
          values: ['SERVER_TEXT', 'SERVER_VOICE', 'DM'],
        },
        { name: 'name', type: 'varchar', nullable: true },
        { name: 'serverId', type: 'uuid', nullable: true },
        { name: 'lastMessageId', type: 'uuid', nullable: true, default: null },
      ],
      relations: [
        { kind: 'many-to-one', target: 'Server', nullable: true },
        { kind: 'one-to-many', target: 'ChannelOverwrite', inverse: 'channel' },
        { kind: 'one-to-many', target: 'ChannelMember', inverse: 'channel' },
      ],
    },
    {
      entity: 'ChannelOverwrite',
      table: 'channel_overwrites',
      source: 'src/channels/entities/channel-overwrite.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'channelId', type: 'varchar' },
        { name: 'targetId', type: 'uuid' },
        { name: 'targetType', type: 'enum', values: ['role', 'user'] },
        { name: 'allow', type: 'varchar', length: 20, default: '0' },
        { name: 'deny', type: 'varchar', length: 20, default: '0' },
      ],
      relations: [
        { kind: 'many-to-one', target: 'Channel', inverse: 'overwrites' },
      ],
    },
    {
      entity: 'ChannelMember',
      table: 'channel_members',
      source: 'src/channels/entities/channel-member.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'channelId', type: 'uuid' },
        { name: 'userId', type: 'uuid' },
      ],
      unique: ['channelId', 'userId'],
      relations: [
        {
          kind: 'many-to-one',
          target: 'Channel',
          inverse: 'dmMembers',
          onDelete: 'CASCADE',
        },
      ],
    },
    {
      entity: 'ReadState',
      table: 'read_states',
      source: 'src/channels/entities/readState.entity.ts',
      columns: [
        { name: 'userId', type: 'uuid', primary: true },
        { name: 'channelId', type: 'uuid', primary: true },
        { name: 'lastReadMessageId', type: 'uuid', nullable: true },
        { name: 'lastReadAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    },
    {
      entity: 'Invitation',
      table: 'invitations',
      source: 'src/invitations/entities/invitation.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'inviteCode', type: 'varchar', unique: true },
        { name: 'serverId', type: 'varchar' },
        { name: 'inviterId', type: 'varchar' },
        { name: 'currentUses', type: 'int', default: 0 },
        { name: 'maxUses', type: 'int', nullable: true, default: null },
        { name: 'expiresAt', type: 'timestamp', nullable: true, default: null },
        { name: 'createdAt', type: 'timestamp', createdAt: true },
        { name: 'deletedAt', type: 'timestamp', deletedAt: true },
      ],
      relations: [
        { kind: 'many-to-one', target: 'Server', inverse: 'invitations' },
        { kind: 'many-to-one', target: 'User', joinColumn: 'inviterId' },
      ],
    },
    {
      entity: 'Message',
      table: 'messages',
      source: 'src/messages/entities/message.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'content', type: 'text' },
        { name: 'authorId', type: 'uuid' },
        { name: 'channelId', type: 'uuid' },
        { name: 'parentMessageId', type: 'varchar', nullable: true },
        { name: 'threadRootMessageId', type: 'varchar', nullable: true },
        { name: 'isDeleted', type: 'boolean', default: false },
        { name: 'editedAt', type: 'timestamptz', nullable: true },
        { name: 'deletedAt', type: 'timestamptz', nullable: true },
        { name: 'createdAt', type: 'timestamp', createdAt: true },
        { name: 'updatedAt', type: 'timestamp', updatedAt: true },
      ],
      relations: [
        { kind: 'many-to-one', target: 'Channel' },
        {
          kind: 'one-to-many',
          target: 'MessageAttachment',
          inverse: 'message',
        },
        { kind: 'one-to-many', target: 'MessageReaction', inverse: 'message' },
      ],
    },
    {
      entity: 'MessageAttachment',
      table: 'message_attachments',
      source: 'src/messages/entities/message-attachment.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'messageId', type: 'varchar' },
        { name: 'url', type: 'text' },
        { name: 'fileName', type: 'varchar', nullable: true },
        { name: 'mimeType', type: 'varchar', nullable: true },
        { name: 'sizeBytes', type: 'int', nullable: true },
        { name: 'createdAt', type: 'timestamp', createdAt: true },
      ],
      relations: [
        {
          kind: 'many-to-one',
          target: 'Message',
          inverse: 'attachments',
          onDelete: 'CASCADE',
        },
      ],
    },
    {
      entity: 'MessageReaction',
      table: 'message_reactions',
      source: 'src/messages/entities/message-reaction.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'messageId', type: 'varchar' },
        { name: 'userId', type: 'varchar' },
        { name: 'emoji', type: 'varchar', length: 64 },
        { name: 'createdAt', type: 'timestamp', createdAt: true },
      ],
      unique: ['messageId', 'userId', 'emoji'],
      relations: [
        {
          kind: 'many-to-one',
          target: 'Message',
          inverse: 'reactions',
          onDelete: 'CASCADE',
        },
      ],
    },
    {
      entity: 'Notification',
      table: 'notifications',
      source: 'src/notifications/entities/notification.entity.ts',
      columns: [
        { name: 'id', type: 'uuid', primary: true, generated: true },
        { name: 'recipientId', type: 'uuid' },
        { name: 'senderId', type: 'uuid' },
        { name: 'serverId', type: 'uuid', nullable: true },
        { name: 'channelId', type: 'uuid', nullable: true },
        { name: 'content', type: 'varchar' },
        { name: 'link', type: 'varchar' },
        {
          name: 'type',
          type: 'enum',
          values: ['DM', 'mention', 'friend_request', 'other'],
        },
        { name: 'isRead', type: 'boolean', default: false },
        { name: 'createdAt', type: 'timestamp', createdAt: true },
      ],
    },
  ],
} as const;
