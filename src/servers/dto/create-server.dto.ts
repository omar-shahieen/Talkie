export class CreateServerDto {
  name: string;
  ownerId: string;
  isPublic?: boolean;
  description?: string;
  category?: string;
  tags?: string[];
  inviteCode?: string;
}
