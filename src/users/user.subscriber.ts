import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d+\$/;

const isAlreadyHashed = (value: string): boolean =>
  BCRYPT_HASH_REGEX.test(value);

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  listenTo() {
    return User;
  }

  async beforeInsert(event: InsertEvent<User>): Promise<void> {
    if (!event.entity?.password) return;

    if (!isAlreadyHashed(event.entity.password)) {
      event.entity.password = await bcrypt.hash(
        event.entity.password,
        SALT_ROUNDS,
      );
    }
  }

  async beforeUpdate(event: UpdateEvent<User>): Promise<void> {
    if (!event.entity) return;

    const isPasswordColumn = event.updatedColumns.some(
      (col) => col.propertyName === 'password',
    );

    const password = event.entity.password as unknown;

    if (
      isPasswordColumn &&
      typeof password === 'string' &&
      password.length > 0 &&
      !isAlreadyHashed(password)
    ) {
      event.entity.password = await bcrypt.hash(password, SALT_ROUNDS);
    }
  }
}
