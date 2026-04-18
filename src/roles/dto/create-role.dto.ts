export class CreateRoleDto {
  name: string;
  serverId: string;
  position?: number;
  permissions?: string;
  isEveryone?: boolean;
}
