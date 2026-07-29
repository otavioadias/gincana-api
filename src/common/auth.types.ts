import { MembershipRole, PlatformRole } from './enums';

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  platformRole: PlatformRole;
  organizationId: string | null;
  membershipId: string | null;
  membershipRole: MembershipRole | null;
}
