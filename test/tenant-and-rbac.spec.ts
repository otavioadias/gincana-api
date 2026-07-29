import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole, PlatformRole } from '../src/common/enums';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { TenantGuard } from '../src/common/guards/tenant.guard';

function contextWithUser(user: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => contextWithUser,
    getClass: () => TenantGuard,
  } as unknown as ExecutionContext;
}

describe('tenant and RBAC guards', () => {
  it('rejects a principal without a tenant membership', () => {
    const guard = new TenantGuard();
    expect(() =>
      guard.canActivate(contextWithUser({ organizationId: null, membershipId: null })),
    ).toThrow(ForbiddenException);
  });

  it('accepts an authenticated tenant derived from the membership', () => {
    const guard = new TenantGuard();
    expect(
      guard.canActivate(contextWithUser({ organizationId: 'org-a', membershipId: 'member-a' })),
    ).toBe(true);
  });

  it('does not grant a MEMBER a MANAGER operation', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([MembershipRole.MANAGER]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() =>
      guard.canActivate(
        contextWithUser({
          platformRole: PlatformRole.USER,
          membershipRole: MembershipRole.MEMBER,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows a platform validator role without granting a team tenant', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PlatformRole.VALIDATOR]),
    } as unknown as Reflector;
    const roles = new RolesGuard(reflector);
    const context = contextWithUser({
      platformRole: PlatformRole.VALIDATOR,
      membershipRole: null,
      organizationId: null,
      membershipId: null,
    });

    expect(roles.canActivate(context)).toBe(true);
    expect(() => new TenantGuard().canActivate(context)).toThrow(ForbiddenException);
  });
});
