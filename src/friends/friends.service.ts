import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';
import { FriendRequest } from './entities/friend-request.entity';
import { Friendship } from './entities/friendship.entity';
import { InjectRepository } from '@nestjs/typeorm';

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
    if (senderId == receiverId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
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
      throw new ForbiddenException(
        'the receiver is the only one can accept request',
      );
    }

    this.assertPending(req);

    await this.requestRepo.update(requestId, { status: 'rejected' });
  }
  // ---------cancel ----------
  async cancelRequest(requestId: string, currentUserId: string) {
    const req = await this.findRequestOrThrow(requestId);

    if (req.senderId !== currentUserId) {
      throw new ForbiddenException('Only the sender can cancel this request');
    }

    this.assertPending(req);

    await this.requestRepo.delete(requestId);
  }

  // ------- Unfriend -----------

  async unfriend(userId: string, targetId: string): Promise<void> {
    const [userId1, userId2] = this.canonicalPair(userId, targetId);
    const result = await this.friendshipRepo.delete({ userId1, userId2 });

    if (result.affected === 0)
      throw new NotFoundException('Friendship not found');
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

    if (!request) throw new NotFoundException('request not found');
    return request;
  }

  private async assertNoFriend(userA: string, userB: string) {
    const [userId1, userId2] = this.canonicalPair(userA, userB);
    const exists = await this.friendshipRepo.exists({
      where: { userId1, userId2 },
    });
    if (exists) throw new ConflictException('You are already friends');
  }

  private async assertNotPending(senderId: string, receiverId: string) {
    const exists = await this.requestRepo.exists({
      where: [
        { senderId, receiverId, status: 'pending' },
        { receiverId: senderId, senderId: receiverId, status: 'pending' },
      ],
    });
    if (exists)
      throw new ConflictException('A pending friend request already exists');
  }

  private assertPending(request: FriendRequest) {
    if (request.status !== 'pending')
      throw new BadRequestException(`Request is already ${request.status}`);
  }

  private canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }
}
