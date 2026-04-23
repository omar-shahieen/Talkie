import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Channel, ChannelType } from '../channels/entities/channel.entity';
import { MessageAttachment } from './entities/message-attachment.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { ChannelMember } from '../channels/entities/channel-member.entity';
import { CreateMessageDto } from './dtos/create-message.dto';
import { UpdateMessageDto } from './dtos/update-message.dto';
import { MessagePaginationDto } from './dtos/pagination.dto';
import { MessageReactionDto } from './dtos/reaction.dto';
import { SearchMessagesDto } from './dtos/search-messages.dto';
import { AppEvents } from '../events/events.enum';
import { EventBusService } from '../events/event-bus.service';
import { LoggingService } from '../logging/logging.service';

interface ElasticHit {
  _id: string;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly channelMembersRepository: Repository<ChannelMember>,
    @InjectRepository(MessageAttachment)
    private readonly attachmentsRepository: Repository<MessageAttachment>,
    @InjectRepository(MessageReaction)
    private readonly reactionsRepository: Repository<MessageReaction>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: MessagesService.name });
  }

  async create(dto: CreateMessageDto, authorId: string) {
    const channel = await this.channelsRepository.findOneBy({
      id: dto.channelId,
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const parent = dto.parentMessageId
      ? await this.messagesRepository.findOneBy({ id: dto.parentMessageId })
      : null;

    if (dto.parentMessageId && !parent) {
      throw new NotFoundException('Parent message not found');
    }

    if (parent && parent.channelId !== dto.channelId) {
      throw new BadRequestException('Reply parent must be in the same channel');
    }

    const threadRootMessageId =
      dto.threadRootMessageId ?? parent?.threadRootMessageId ?? undefined;

    const created = await this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        channelId: dto.channelId,
        content: dto.content,
        authorId,
        parentMessageId: dto.parentMessageId,
        threadRootMessageId,
      });
      const savedMessage = await manager.save(Message, message);

      if (dto.attachments?.length) {
        const attachments = dto.attachments.map((attachment) =>
          manager.create(MessageAttachment, {
            messageId: savedMessage.id,
            ...attachment,
          }),
        );
        await manager.save(MessageAttachment, attachments);
      }

      channel.lastMessageId = savedMessage.id;
      await manager.save(Channel, channel);

      return manager.findOneOrFail(Message, {
        where: { id: savedMessage.id },
        relations: ['attachments', 'reactions'],
      });
    });

    await this.emitMessageCreatedEvents(created, channel, dto.mentions ?? []);
    void this.syncMessageToElastic(created, channel);

    return created;
  }

  async update(id: string, dto: UpdateMessageDto, requesterId: string) {
    const message = await this.messagesRepository.findOneBy({ id });
    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== requesterId) {
      throw new ForbiddenException('Only the author can edit this message');
    }

    message.content = dto.content;
    message.editedAt = new Date();

    const saved = await this.messagesRepository.save(message);

    this.eventBus.emit(AppEvents.MESSAGE_UPDATED, {
      id: saved.id,
      channelId: saved.channelId,
      content: saved.content,
      editedAt: saved.editedAt,
    });

    const channel = await this.channelsRepository.findOneBy({
      id: saved.channelId,
    });
    if (channel) {
      void this.syncMessageToElastic(saved, channel);
    }

    return saved;
  }

  async remove(id: string, requesterId: string) {
    const message = await this.messagesRepository.findOneBy({ id });
    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== requesterId) {
      throw new ForbiddenException('Only the author can delete this message');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = '[deleted]';

    const saved = await this.messagesRepository.save(message);

    this.eventBus.emit(AppEvents.MESSAGE_DELETED, {
      id: saved.id,
      channelId: saved.channelId,
      deletedAt: saved.deletedAt,
    });

    void this.deleteMessageFromElastic(saved.id);

    return { success: true };
  }

  async listChannelMessages(channelId: string, query: MessagePaginationDto) {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const limit = query.limit ?? 30;
    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.attachments', 'attachment')
      .leftJoinAndSelect('message.reactions', 'reaction')
      .where('message.channelId = :channelId', { channelId })
      .andWhere('message.isDeleted = false')
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      qb.andWhere('message.createdAt < :cursor', {
        cursor: new Date(query.cursor),
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor:
        hasMore && items.length
          ? items[items.length - 1].createdAt.toISOString()
          : null,
    };
  }

  async listReplies(messageId: string, query: MessagePaginationDto) {
    const parent = await this.messagesRepository.findOneBy({ id: messageId });
    if (!parent) {
      throw new NotFoundException('Parent message not found');
    }

    const limit = query.limit ?? 30;
    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.attachments', 'attachment')
      .leftJoinAndSelect('message.reactions', 'reaction')
      .where('message.parentMessageId = :messageId', { messageId })
      .andWhere('message.isDeleted = false')
      .orderBy('message.createdAt', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .take(limit + 1);

    if (query.cursor) {
      qb.andWhere('message.createdAt > :cursor', {
        cursor: new Date(query.cursor),
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor:
        hasMore && items.length
          ? items[items.length - 1].createdAt.toISOString()
          : null,
    };
  }

  async listThread(rootMessageId: string, query: MessagePaginationDto) {
    const root = await this.messagesRepository.findOneBy({ id: rootMessageId });
    if (!root) {
      throw new NotFoundException('Thread root message not found');
    }

    const limit = query.limit ?? 30;
    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.attachments', 'attachment')
      .leftJoinAndSelect('message.reactions', 'reaction')
      .where('message.id = :rootMessageId', { rootMessageId })
      .orWhere('message.threadRootMessageId = :rootMessageId', {
        rootMessageId,
      })
      .andWhere('message.isDeleted = false')
      .orderBy('message.createdAt', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .take(limit + 1);

    if (query.cursor) {
      qb.andWhere('message.createdAt > :cursor', {
        cursor: new Date(query.cursor),
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor:
        hasMore && items.length
          ? items[items.length - 1].createdAt.toISOString()
          : null,
    };
  }

  async addReaction(
    messageId: string,
    userId: string,
    dto: MessageReactionDto,
  ) {
    const message = await this.messagesRepository.findOneBy({ id: messageId });
    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    const exists = await this.reactionsRepository.findOneBy({
      messageId,
      userId,
      emoji: dto.emoji,
    });

    if (exists) {
      return exists;
    }

    const reaction = this.reactionsRepository.create({
      messageId,
      userId,
      emoji: dto.emoji,
    });
    const saved = await this.reactionsRepository.save(reaction);

    this.eventBus.emit(AppEvents.MESSAGE_REACTION_ADDED, {
      messageId,
      channelId: message.channelId,
      emoji: saved.emoji,
      userId,
    });

    return saved;
  }

  async removeReaction(
    messageId: string,
    userId: string,
    dto: MessageReactionDto,
  ) {
    const message = await this.messagesRepository.findOneBy({ id: messageId });
    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    const reaction = await this.reactionsRepository.findOneBy({
      messageId,
      userId,
      emoji: dto.emoji,
    });
    if (!reaction) {
      throw new NotFoundException('Reaction not found');
    }

    await this.reactionsRepository.remove(reaction);

    this.eventBus.emit(AppEvents.MESSAGE_REACTION_REMOVED, {
      messageId,
      channelId: message.channelId,
      emoji: dto.emoji,
      userId,
    });

    return { success: true };
  }

  async search(query: SearchMessagesDto) {
    const limit = query.limit ?? 30;
    const offset = query.offset ?? 0;

    if (query.keyword && this.isElasticConfigured()) {
      try {
        const ids = await this.searchIdsInElastic(query, limit, offset);
        if (!ids.length) {
          return { items: [], total: 0, engine: 'elasticsearch' };
        }

        const items = await this.messagesRepository.find({
          where: ids.map((id) => ({ id, isDeleted: false })),
          relations: ['attachments', 'reactions'],
        });

        const sorted = ids
          .map((id) => items.find((item) => item.id === id))
          .filter((item): item is Message => Boolean(item));

        return {
          items: sorted,
          total: sorted.length,
          engine: 'elasticsearch',
        };
      } catch (error) {
        this.logger.warn(
          `Elasticsearch search failed, fallback to postgres: ${String(error)}`,
          MessagesService.name,
        );
      }
    }

    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.attachments', 'attachment')
      .leftJoinAndSelect('message.reactions', 'reaction')
      .leftJoin('message.channel', 'channel')
      .where('message.isDeleted = false');

    if (query.keyword?.trim()) {
      qb.andWhere('message.content ILIKE :keyword', {
        keyword: `%${query.keyword.trim()}%`,
      });
    }

    if (query.authorId) {
      qb.andWhere('message.authorId = :authorId', { authorId: query.authorId });
    }

    if (query.channelId) {
      qb.andWhere('message.channelId = :channelId', {
        channelId: query.channelId,
      });
    }

    if (query.serverId) {
      qb.andWhere('channel.serverId = :serverId', { serverId: query.serverId });
    }

    if (query.from) {
      qb.andWhere('message.createdAt >= :from', {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      qb.andWhere('message.createdAt <= :to', { to: new Date(query.to) });
    }

    qb.orderBy('message.createdAt', 'DESC').skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, engine: 'postgres' };
  }

  private async emitMessageCreatedEvents(
    message: Message,
    channel: Channel,
    mentions: string[],
  ) {
    const basePayload: Record<string, unknown> = {
      id: message.id,
      channelId: message.channelId,
      content: message.content,
      authorId: message.authorId,
      createdAt: message.createdAt,
      serverId: channel.serverId,
    };

    if (channel.type === ChannelType.DM) {
      const members = await this.channelMembersRepository.findBy({
        channelId: channel.id,
      });

      const recipient = members.find(
        (member) => member.userId !== message.authorId,
      );
      if (recipient) {
        basePayload.senderId = message.authorId;
        basePayload.recipientId = recipient.userId;
        basePayload.recepientId = recipient.userId;
        basePayload.type = 'DM';
        basePayload.isDirectMessage = true;
      }
    } else if (mentions.length) {
      basePayload.type = 'mention';
      basePayload.senderId = message.authorId;
      basePayload.channelName = channel.name ?? 'channel';
      basePayload.mentions = mentions;
    }

    this.eventBus.emit(AppEvents.MESSAGE_CREATED, basePayload);
  }

  private isElasticConfigured(): boolean {
    return Boolean(process.env.ELASTICSEARCH_NODE);
  }

  private async searchIdsInElastic(
    query: SearchMessagesDto,
    limit: number,
    offset: number,
  ): Promise<string[]> {
    const node = process.env.ELASTICSEARCH_NODE;
    if (!node) {
      return [];
    }

    const must: Record<string, unknown>[] = [{ term: { isDeleted: false } }];

    if (query.keyword?.trim()) {
      must.push({
        multi_match: {
          query: query.keyword.trim(),
          fields: ['content^3', 'authorId', 'channelId', 'serverId'],
        },
      });
    }

    if (query.authorId) must.push({ term: { authorId: query.authorId } });
    if (query.channelId) must.push({ term: { channelId: query.channelId } });
    if (query.serverId) must.push({ term: { serverId: query.serverId } });

    const filter: Record<string, unknown>[] = [];
    if (query.from || query.to) {
      filter.push({
        range: {
          createdAt: {
            gte: query.from,
            lte: query.to,
          },
        },
      });
    }

    const response = await fetch(`${node}/messages/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: offset,
        size: limit,
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: [{ createdAt: { order: 'desc' } }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch search failed with ${response.status}`);
    }

    const json = (await response.json()) as {
      hits?: { hits?: ElasticHit[] };
    };

    return (json.hits?.hits ?? []).map((hit) => hit._id);
  }

  private async syncMessageToElastic(message: Message, channel: Channel) {
    const node = process.env.ELASTICSEARCH_NODE;
    if (!node) return;

    try {
      await fetch(`${node}/messages/_doc/${message.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: message.id,
          content: message.content,
          authorId: message.authorId,
          channelId: message.channelId,
          serverId: channel.serverId,
          createdAt: message.createdAt,
          isDeleted: message.isDeleted,
        }),
      });
    } catch (error) {
      this.logger.warn(
        `Elasticsearch sync failed for message ${message.id}: ${String(error)}`,
        MessagesService.name,
      );
    }
  }

  private async deleteMessageFromElastic(messageId: string) {
    const node = process.env.ELASTICSEARCH_NODE;
    if (!node) return;

    try {
      await fetch(`${node}/messages/_doc/${messageId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      this.logger.warn(
        `Elasticsearch delete failed for message ${messageId}: ${String(error)}`,
        MessagesService.name,
      );
    }
  }
}
