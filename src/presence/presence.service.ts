import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';
import { PresenceStatus } from '../messages/chat.types';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

export const PRESENCE_PRIORITIES: Record<PresenceStatus, number> = {
  dnd: 3,
  online: 2,
  idle: 1,
  offline: 0,
};
export type DeviceSession = {
  status: PresenceStatus;
  lastHeartbeat: number;
};
export type CACHE_PRESENCE_VALUE = {
  // Map of socketId -> DeviceSession
  connections: Record<string, DeviceSession>;
};

@Injectable()
export class PresenceService {
  private TTL = 60 * 1000; //  60 seconds
  private HEARTBEAT_TIMEOUT = 30 * 1000;

  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly logger: LoggingService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private cachePresenseKey(userId: string) {
    return `presence:${userId}`;
  }

  private ALLOWED_TRANSITIONS: Record<PresenceStatus, PresenceStatus[]> = {
    online: ['idle', 'dnd', 'offline'],
    idle: ['online', 'dnd', 'offline'],
    dnd: ['online', 'offline'], // dnd → idle not allowed
    offline: ['online'],
  };

  isValidTransition(from: PresenceStatus, to: PresenceStatus): boolean {
    return this.ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }
  private pruneStaleSessions(data: CACHE_PRESENCE_VALUE): void {
    const now = Date.now();
    for (const [socketId, session] of Object.entries(data.connections)) {
      if (now - session.lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
        delete data.connections[socketId];
      }
    }
  }

  // Restore status on first connect — reads DB preference
  async getRestoredStatus(userId: string): Promise<PresenceStatus> {
    // If Redis already has state (another tab connected), use it
    const existing = await this.cache.get<CACHE_PRESENCE_VALUE>(
      this.cachePresenseKey(userId),
    );
    if (existing && Object.keys(existing.connections).length > 0) {
      return this.getEffectivePresence(existing);
    }

    // No live state — restore from DB
    const user = await this.usersRepository.findOneByOrFail({ id: userId });

    if (!user.status_preference) return 'online';

    if (user.status_preference === 'dnd') {
      // Check if DND has expired
      if (user.dnd_until && new Date() > new Date(user.dnd_until)) {
        await this.usersRepository.update(userId, {
          status_preference: null,
          dnd_until: null,
        });

        return 'online';
      }
      return 'dnd';
    }

    return 'online';
  }

  // Persist user intent to DB — only called for dnd or clearing dnd
  async saveStatusPreference(
    userId: string,
    status: PresenceStatus,
    dndUntil?: Date,
  ): Promise<void> {
    if (status === 'dnd') {
      await this.usersRepository.update(userId, {
        status_preference: 'dnd',
        dnd_until: dndUntil ?? null,
      });
    } else {
      // Any non-dnd status clears the saved preference
      await this.usersRepository.update(userId, {
        status_preference: null,
        dnd_until: null,
      });
    }
  }

  // Get current effective status for a user (used for transition validation)
  async getEffectiveStatus(userId: string): Promise<PresenceStatus> {
    const data = await this.cache.get<CACHE_PRESENCE_VALUE>(
      this.cachePresenseKey(userId),
    );
    if (!data) return 'offline';
    return this.getEffectivePresence(data);
  }
  // call it in getEffectivePresence or addConnections
  getEffectivePresence(data: CACHE_PRESENCE_VALUE): PresenceStatus {
    this.pruneStaleSessions(data);

    const socketIds = Object.keys(data.connections);
    if (socketIds.length === 0) {
      return 'offline';
    }

    let heighestPriority = -1;
    let effectiveStatus: PresenceStatus = 'offline';

    for (const socketId of socketIds) {
      const session = data.connections[socketId];

      const priority = PRESENCE_PRIORITIES[session.status];

      if (priority > heighestPriority) {
        heighestPriority = priority;
        effectiveStatus = session.status;
      }
    }

    return effectiveStatus;
  }

  async addConnections(
    userId: string,
    clientId: string,
    initialStatus: PresenceStatus = 'online',
  ) {
    const key = this.cachePresenseKey(userId);

    let data = await this.cache.get<CACHE_PRESENCE_VALUE>(key);

    if (!data) {
      data = {
        connections: {},
      };
    }

    this.pruneStaleSessions(data);

    const connections = Object.keys(data.connections);
    const wasOffline = connections.length === 0;
    if (!connections.includes(clientId)) {
      data.connections[clientId] = {
        status: initialStatus,
        lastHeartbeat: Date.now(),
      };
    }

    await this.cache.set(key, data, this.TTL);
    return wasOffline;
  }
  async removeConnection(userId: string, clientId: string) {
    const key = this.cachePresenseKey(userId);

    const data = await this.cache.get<CACHE_PRESENCE_VALUE>(key);

    if (!data) return false;

    delete data.connections[clientId];

    this.logger.log(`Socket disconnected: ${clientId} for user: ${userId}`);

    const connections = Object.keys(data.connections);

    if (connections.length === 0) {
      await this.cache.del(key);

      this.logger.log(`User ${userId} became offline`);
      return true;
    } else {
      await this.cache.set(key, data, this.TTL);
      return false;
    }
  }

  async updateStatus(
    userId: string,
    clientId: string,
    newStatus: PresenceStatus,
  ) {
    const key = this.cachePresenseKey(userId);

    const data = await this.cache.get<CACHE_PRESENCE_VALUE>(key);
    if (!data || !data.connections[clientId]) return; // if there is no session for this user stop

    const oldEffectivePresence = this.getEffectivePresence(data);

    // update socket status
    data.connections[clientId].status = newStatus;
    data.connections[clientId].lastHeartbeat = Date.now();

    await this.cache.set(key, data, this.TTL);

    // get new calculated presence
    const newEffectivePresence = this.getEffectivePresence(data);

    return oldEffectivePresence !== newEffectivePresence;
  }
  async refreshHeartbeat(userId: string, clientId: string) {
    const key = this.cachePresenseKey(userId);

    const data = await this.cache.get<CACHE_PRESENCE_VALUE>(key);

    if (!data) return;

    // Check if the key exists on the object
    if (!data.connections[clientId]) return;

    // Update the specific session's heartbeat
    data.connections[clientId].lastHeartbeat = Date.now();

    await this.cache.set(key, data, this.TTL);
  }
}
