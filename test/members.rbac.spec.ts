import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Sequelize } from 'sequelize-typescript';
import { AuthenticatedPrincipal } from '../src/common/auth.types';
import { EntityStatus, MembershipRole, PlatformRole } from '../src/common/enums';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Membership, User } from '../src/database/models';
import { MembersController } from '../src/modules/members/members.controller';
import { MembersService } from '../src/modules/members/members.service';

function principal(role: MembershipRole): AuthenticatedPrincipal {
  return {
    userId: 'user-a',
    email: 'user@example.com',
    platformRole: PlatformRole.USER,
    organizationId: 'organization-a',
    membershipId: 'membership-a',
    membershipRole: role,
  };
}

function contextFor(
  handler: (...args: never[]) => unknown,
  user: AuthenticatedPrincipal,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => MembersController,
  } as unknown as ExecutionContext;
}

function controllerHandler(name: keyof MembersController): (...args: never[]) => unknown {
  return Object.getOwnPropertyDescriptor(MembersController.prototype, name)?.value as (
    ...args: never[]
  ) => unknown;
}

describe('members RBAC and participant projection', () => {
  const guard = new RolesGuard(new Reflector());

  it.each([MembershipRole.MEMBER, MembershipRole.MANAGER])(
    'allows %s to list participant options',
    (role) => {
      expect(
        guard.canActivate(contextFor(controllerHandler('findParticipants'), principal(role))),
      ).toBe(true);
      expect(guard.canActivate(contextFor(controllerHandler('findAll'), principal(role)))).toBe(true);
    },
  );

  it('lets a platform validator select the organization explicitly', async () => {
    const findParticipants = jest.fn().mockResolvedValue([]);
    const controller = new MembersController({
      findParticipants,
    } as unknown as MembersService);
    const validator: AuthenticatedPrincipal = {
      userId: 'validator-a',
      email: 'validator@example.com',
      platformRole: PlatformRole.VALIDATOR,
      organizationId: null,
      membershipId: null,
      membershipRole: null,
    };

    await controller.findParticipants(validator, 'organization-b');

    expect(findParticipants).toHaveBeenCalledWith('organization-b');
  });

  it.each([MembershipRole.MEMBER])(
    'keeps member administration blocked for %s',
    (role) => {
      expect(() =>
        guard.canActivate(contextFor(controllerHandler('findOne'), principal(role))),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(contextFor(controllerHandler('create'), principal(role))),
      ).toThrow(ForbiddenException);
    },
  );

  it('returns only active participants with a minimal user projection', async () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const service = new MembersService(
      { findAll } as unknown as typeof Membership,
      {} as typeof User,
      {} as Sequelize,
      {} as ConfigService,
    );

    await service.findParticipants('organization-a');

    expect(findAll).toHaveBeenCalledWith({
      attributes: ['id', 'userId', 'role', 'status'],
      where: { organizationId: 'organization-a', status: EntityStatus.ACTIVE },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'status'],
          where: { status: EntityStatus.ACTIVE },
          required: true,
        },
      ],
      order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
    });
  });

  it('preserves the administrative list for managers and uses the safe list for other roles', async () => {
    const administrative = [{ id: 'admin-list' }] as Membership[];
    const participants = [{ id: 'participant-list' }] as Membership[];
    const members = {
      findAll: jest.fn().mockResolvedValue(administrative),
      findParticipants: jest.fn().mockResolvedValue(participants),
    } as unknown as MembersService;
    const controller = new MembersController(members);

    await expect(controller.findAll(principal(MembershipRole.MANAGER))).resolves.toBe(
      administrative,
    );
    await expect(controller.findAll(principal(MembershipRole.MEMBER))).resolves.toBe(participants);
  });
});
