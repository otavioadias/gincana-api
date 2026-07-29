import { SetMetadata } from '@nestjs/common';
import { MembershipRole, PlatformRole } from '../enums';

export const ROLES_KEY = 'roles';
export type AllowedRole = MembershipRole | PlatformRole;
export const Roles = (...roles: AllowedRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
