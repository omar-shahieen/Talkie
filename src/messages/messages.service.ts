import { Injectable } from '@nestjs/common';

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
import { LoggingService } from '../logging/logging.service';
import { EventBusService } from 'src/events/eventBus.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from 'src/common/exceptions/domain.exception';
import { MessageRetentionQueueService } from './message-retention-queue.service';
import { DELETE_FOR_EVERYONE_WINDOW_MS } from './message.constant';

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
    @InjectRepository(MessageReaction)
    private readonly reactionsRepository: Repository<MessageReaction>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
    private readonly logger: LoggingService,
    private readonly messageRetentionQueue: MessageRetentionQueueService,
  ) {}

  async create(dto: CreateMessageDto, authorId: string) {
    const channel = await this.channelsRepository.findOneBy({
      id: dto.channelId,
    });
    if (!channel) {
      throw new NotFoundException('channel', dto.channelId, {
        action: 'createMessage',
        channelId: dto.channelId,
        message:
          'The target channel does not exist. Please verify the channel ID.',
      });
    }

    const parent = dto.parentMessageId
      ? await this.messagesRepository.findOneBy({ id: dto.parentMessageId })
      : null;

    if (dto.parentMessageId && !parent) {
      throw new NotFoundException('message', dto.parentMessageId, {
        action: 'createMessage',
        messageId: dto.parentMessageId,
        message:
          'The parent message for this reply does not exist or has been deleted.',
      });
    }

    if (parent && parent.channelId !== dto.channelId) {
      throw new BadRequestException(
        'You cannot reply to a message from a different channel. The parent message must be in the same channel.',
        {
          action: 'createMessage',
          channelId: dto.channelId,
          parentChannelId: parent.channelId,
          parentMessageId: dto.parentMessageId,
        },
      );
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

    const author = await this.usersRepository.findOne({
      where: { id: authorId },
      select: ['id', 'username', 'firstName', 'lastName', 'avatar'],
    });

    await this.emitMessageCreatedEvents(
      created,
      channel,
      dto.mentions ?? [],
      author,
    );
    void this.syncMessageToElastic(created, channel);

    return created;
  }

  async update(id: string, dto: UpdateMessageDto, requesterId: string) {
    const message = await this.messagesRepository.findOneBy({ id });
    if (!message || message.isDeleted) {
      throw new NotFoundException('message', id, {
        messageId: id,
        message: 'This message does not exist or has been deleted.',
      });
    }

    if (message.authorId !== requesterId) {
      throw new ForbiddenException('update message', {
        message:
          'You can only edit your own messages. Only the message author can make changes.',
      });
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
    if (!message) {
      throw new NotFoundException('message', id, {
        messageId: id,
        message: 'This message does not exist or has been deleted.',
      });
    }

    if (message.authorId !== requesterId) {
      throw new ForbiddenException('remove message', {
        message:
          'You can only delete your own messages. Only the message author can remove it.',
      });
    }

    if (message.isDeleted) {
      return {
        message: 'Message deleted successfully.',
        softDeleted: true,
        hardDeleteQueued: true,
      };
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await this.messagesRepository.save(message);
    await this.refreshChannelLastMessage(message.channelId);
    await this.messageRetentionQueue.enqueueHardDelete(message.id);

    this.eventBus.emit(AppEvents.MESSAGE_DELETED, {
      id: message.id,
      channelId: message.channelId,
      deletedAt: message.deletedAt,
    });

    void this.deleteMessageFromElastic(message.id);

    return {
      message: 'Message deleted successfully.',
      softDeleted: true,
      hardDeleteQueued: true,
    };
  }

  async removeForEveryone(id: string, requesterId: string) {
    const message = await this.messagesRepository.findOneBy({ id });
    if (!message) {
      throw new NotFoundException('message', id, {
        messageId: id,
        message: 'This message does not exist or has been deleted.',
      });
    }

    if (message.authorId !== requesterId) {
      throw new ForbiddenException('delete message for everyone', {
        message:
          'You can only delete your own messages for everyone. Only the message author can perform this action.',
      });
    }

    if (message.isDeleted && message.deletedForEveryone) {
      return {
        message: 'Message already deleted for everyone.',
        deletedForEveryone: true,
      };
    }

    const elapsedMs = Date.now() - message.createdAt.getTime();
    if (elapsedMs > DELETE_FOR_EVERYONE_WINDOW_MS) {
      throw new ForbiddenException('delete message for everyone', {
        errorCode: 'DELETION_WINDOW_EXPIRED',
        message:
          'The 24-hour window for deleting this message for everyone has expired. You can still delete it for yourself.',
        createdAt: message.createdAt.toISOString(),
        windowMs: DELETE_FOR_EVERYONE_WINDOW_MS,
      });
    }

    message.isDeleted = true;
    message.deletedForEveryone = true;
    message.deletedAt = new Date();
    message.content = '';
    await this.messagesRepository.save(message);
    await this.refreshChannelLastMessage(message.channelId);
    await this.messageRetentionQueue.enqueueHardDelete(message.id);

    this.eventBus.emit(AppEvents.MESSAGE_DELETED_FOR_EVERYONE, {
      id: message.id,
      channelId: message.channelId,
      deletedAt: message.deletedAt,
      deletedForEveryone: true,
    });

    void this.deleteMessageFromElastic(message.id);

    return {
      message: 'Message deleted for everyone.',
      deletedForEveryone: true,
      hardDeleteQueued: true,
    };
  }

  async hardDeleteSoftDeletedMessage(messageId: string) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
      select: ['id', 'channelId', 'isDeleted'],
    });

    if (!message || !message.isDeleted) {
      return;
    }

    await this.messagesRepository.delete({ id: message.id });
    await this.refreshChannelLastMessage(message.channelId);
    await this.deleteMessageFromElastic(message.id);

    this.logger.log(`Hard-deleted soft-deleted message ${message.id}`, {
      context: MessagesService.name,
      action: 'hardDeleteSoftDeletedMessage',
      messageId: message.id,
      channelId: message.channelId,
    });
  }

  async listChannelMessages(channelId: string, query: MessagePaginationDto) {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) {
      throw new NotFoundException('channel', channelId, {
        action: 'listChannelMessages',
        channelId,
        message: 'This channel does not exist or has been deleted.',
      });
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
      throw new NotFoundException('message', messageId, {
        action: 'listReplies',
        messageId,
        message: 'This message does not exist or has been deleted.',
      });
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
      throw new NotFoundException('message', rootMessageId, {
        action: 'listThread',
        messageId: rootMessageId,
        message:
          'The root message for this thread does not exist or has been deleted.',
      });
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
      throw new NotFoundException('message', messageId, {
        action: 'addReaction',
        messageId,
        message: 'This message does not exist or has been deleted.',
      });
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
      throw new NotFoundException('message', messageId, {
        action: 'removeReaction',
        messageId,
        message: 'This message does not exist or has been deleted.',
      });
    }

    const reaction = await this.reactionsRepository.findOneBy({
      messageId,
      userId,
      emoji: dto.emoji,
    });
    if (!reaction) {
      throw new NotFoundException('reaction', `${messageId}:${dto.emoji}`, {
        action: 'removeReaction',
        messageId,
        userId,
        emoji: dto.emoji,
        message: 'This reaction does not exist or has already been removed.',
      });
    }

    await this.reactionsRepository.remove(reaction);

    this.eventBus.emit(AppEvents.MESSAGE_REACTION_REMOVED, {
      messageId,
      channelId: message.channelId,
      emoji: dto.emoji,
      userId,
    });

    return { message: 'Reaction removed successfully.' };
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
        this.logger.warn('Elasticsearch search failed, fallback to postgres', {
          context: MessagesService.name,
          action: 'search',
          error: String(error),
        });
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
    author?: User | null,
  ) {
    const basePayload: Record<string, unknown> = {
      id: message.id,
      channelId: message.channelId,
      content: message.content,
      authorId: message.authorId,
      createdAt: message.createdAt,
      serverId: channel.serverId,
      user: author
        ? {
            id: author.id,
            name:
              author.firstName + (author.lastName ? ` ${author.lastName}` : ''),
            username: author.username,
            avatar: author.avatar,
          }
        : undefined,
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
      this.logger.warn('Elasticsearch sync failed for message', {
        context: MessagesService.name,
        action: 'syncMessageToElastic',
        messageId: message.id,
        error: String(error),
      });
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
      this.logger.warn('Elasticsearch delete failed for message', {
        context: MessagesService.name,
        action: 'deleteMessageFromElastic',
        messageId,
        error: String(error),
      });
    }
  }

  private async refreshChannelLastMessage(channelId: string) {
    const lastMessage = await this.messagesRepository.findOne({
      where: { channelId, isDeleted: false },
      order: { createdAt: 'DESC', id: 'DESC' },
      select: ['id'],
    });

    await this.channelsRepository.update(
      { id: channelId },
      { lastMessageId: lastMessage?.id ?? null },
    );
  }
}
