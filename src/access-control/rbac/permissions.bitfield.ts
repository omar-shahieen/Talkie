// src/permissions/permissions.bitfield.ts
import { Permission } from './permissions.constants';

export class PermissionsBitfield {
  constructor(private bits: bigint = 0n) {}

  static from(value: bigint | string): PermissionsBitfield {
    return new PermissionsBitfield(BigInt(value));
  }

  static ALL = new PermissionsBitfield(
    Object.values(Permission).reduce((acc, bit) => acc | bit, 0n),
  );

  has(permission: bigint): boolean {
    if ((this.bits & Permission.Administrator) === Permission.Administrator)
      return true;
    return (this.bits & permission) === permission;
  }

  hasAll(...permissions: bigint[]): boolean {
    return permissions.every((p) => this.has(p));
  }

  add(bits: bigint): PermissionsBitfield {
    return new PermissionsBitfield(this.bits | bits);
  }

  remove(bits: bigint): PermissionsBitfield {
    return new PermissionsBitfield(this.bits & ~bits);
  }

  toJSON() {
    return this.bits.toString();
  }

  toGrantedList(): string[] {
    return Object.entries(Permission)
      .filter(([, bit]) => (this.bits & bit) === bit)
      .map(([name]) => name);
  }

  valueOf(): bigint {
    return this.bits;
  }
}
