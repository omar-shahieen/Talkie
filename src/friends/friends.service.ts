import { Injectable } from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';
import { FriendRequest } from './entities/friend-request.entity';
import { Friendship } from './entities/friendship.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from 'src/common/exceptions/domain.exception';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(FriendRequest)
    private readonly requestRepo: Repository<FriendRequest>,

    @InjectRepository(Friendship)
    private readonly friendshipRepo: Repository<Friendship>,

    private readonly dataSource: DataSource,
  ) {}

  // ---------send ----------

  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself. Friend requests can only be sent to other users.',
        {
          userId: senderId,
        },
      );
    }

    await this.assertNoFriend(senderId, receiverId);

    await this.assertNotPending(senderId, receiverId);

    return await this.requestRepo.save({
      senderId,
      receiverId,
    });
  }

  // ---------accept ----------

  async acceptRequest(requestId: string, currentUserId: string) {
    const req = await this.findRequestOrThrow(requestId);

    if (req.senderId === currentUserId) {
      throw new ForbiddenException(
        'the receiver is the only one can accept request',
      );
    }

    this.assertPending(req);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(FriendRequest, requestId, { status: 'accepted' });

      const [userId1, userId2] = this.canonicalPair(
        req.senderId,
        req.receiverId,
      );
      await manager.save(Friendship, { userId1, userId2 });
    });
  }
  // ---------reject ----------

  async rejectRequest(requestId: string, currentUserId: string) {
    const req = await this.findRequestOrThrow(requestId);

    if (req.senderId === currentUserId) {
      throw new ForbiddenException('reject request', {
        message:
          'Only the receiver of this friend request can reject it. As the sender, you can cancel the request instead.',
        senderId: req.senderId,
        currentUserId,
      });
    }

    this.assertPending(req);

    await this.requestRepo.update(requestId, { status: 'rejected' });
  }
  // ---------cancel ----------
  async cancelRequest(requestId: string, currentUserId: string) {
    const req = await this.findRequestOrThrow(requestId);

    if (req.senderId !== currentUserId) {
      throw new ForbiddenException('cancel request', {
        message:
          'Only the sender of this friend request can cancel it. The receiver can accept or reject it instead.',
        senderId: req.senderId,
        currentUserId,
      });
    }

    this.assertPending(req);

    await this.requestRepo.delete(requestId);
  }

  // ------- Unfriend -----------

  async unfriend(userId: string, targetId: string): Promise<void> {
    const [userId1, userId2] = this.canonicalPair(userId, targetId);
    const result = await this.friendshipRepo.delete({ userId1, userId2 });

    if (result.affected === 0)
      throw new NotFoundException('friendship', `${userId1}:${userId2}`, {
        userId1,
        userId2,
        message:
          'You are not friends with this user. The friendship may have already been removed.',
      });
  }

  // ---- Queries -----------

  async getIncomingRequests(userId: string): Promise<FriendRequest[]> {
    return this.requestRepo.find({
      where: { receiverId: userId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
  }

  async getOutgoingRequests(userId: string): Promise<FriendRequest[]> {
    return this.requestRepo.find({
      where: { senderId: userId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
  }

  async getFriends(userId: string): Promise<Friendship[]> {
    return this.friendshipRepo.find({
      where: [{ userId1: userId }, { userId2: userId }],
      order: { createdAt: 'DESC' },
    });
  }

  // ---------helpers----------------
  private async findRequestOrThrow(id: string) {
    const request = await this.requestRepo.findOneBy({ id });

    if (!request)
      throw new NotFoundException('request', id, {
        requestId: id,
        message:
          'This friend request does not exist or may have already been processed.',
      });
    return request;
  }

  private async assertNoFriend(userA: string, userB: string) {
    const [userId1, userId2] = this.canonicalPair(userA, userB);
    const exists = await this.friendshipRepo.exists({
      where: { userId1, userId2 },
    });
    if (exists)
      throw new ConflictException(
        'You are already friends with this user. No need to send another friend request.',
      );
  }

  private async assertNotPending(senderId: string, receiverId: string) {
    const exists = await this.requestRepo.exists({
      where: [
        { senderId, receiverId, status: 'pending' },
        { receiverId: senderId, senderId: receiverId, status: 'pending' },
      ],
    });
    if (exists) {
      throw new ConflictException(
        'A pending friend request between you and this user already exists. Please wait for a response or cancel it first.',
        {
          receiverId,
          senderId,
        },
      );
    }
  }

  private assertPending(request: FriendRequest) {
    if (request.status !== 'pending') {
      throw new BadRequestException(
        `This friend request is already ${request.status}. You cannot perform this action on a completed request.`,
        {
          requestId: request.id,
        },
      );
    }
  }

  private canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }
}
