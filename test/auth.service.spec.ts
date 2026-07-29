import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { EntityStatus, MembershipRole, PlatformRole } from '../src/common/enums';
import { Membership, Organization, RefreshToken, User } from '../src/database/models';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService login and refresh rotation', () => {
  const user = {
    id: 'user-a',
    email: 'member@example.com',
    status: EntityStatus.ACTIVE,
    platformRole: PlatformRole.USER,
  } as User;
  const membership = {
    id: 'membership-a',
    organizationId: 'organization-a',
    role: MembershipRole.MEMBER,
  } as Membership;
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed-access-token'),
  } as unknown as JwtService;
  const config = {
    get: jest.fn((_key: string, fallback: unknown) => fallback),
  } as unknown as ConfigService;

  it('logs in with a valid password and stores only a refresh-token hash', async () => {
    user.passwordHash = await bcrypt.hash('StrongPassword123!', 4);
    let storedTokenHash = '';
    const create = jest.fn((values: unknown) => {
      if (
        typeof values === 'object' &&
        values !== null &&
        'tokenHash' in values &&
        typeof values.tokenHash === 'string'
      ) {
        storedTokenHash = values.tokenHash;
      }
      return Promise.resolve({ id: 'refresh-a' });
    });
    const service = new AuthService(
      { findOne: jest.fn().mockResolvedValue(user) } as unknown as typeof User,
      { findOne: jest.fn().mockResolvedValue(membership) } as unknown as typeof Membership,
      {} as typeof Organization,
      { create } as unknown as typeof RefreshToken,
      {} as Sequelize,
      jwt,
      config,
    );

    const pair = await service.login({
      email: user.email,
      password: 'StrongPassword123!',
    });

    expect(pair.accessToken).toBe('signed-access-token');
    expect(pair.refreshToken).toHaveLength(64);
    expect(storedTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedTokenHash).not.toBe(pair.refreshToken);
  });

  it('revokes the consumed refresh token and links its replacement', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const current = {
      id: 'refresh-old',
      userId: user.id,
      user,
      revokedAt: null,
      deviceInfo: 'browser',
      save,
    };
    const transaction = { LOCK: { UPDATE: 'UPDATE' } } as unknown as Transaction;
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ id: 'refresh-new' });
    const refreshModel = {
      findOne,
      findByPk: jest.fn().mockResolvedValue(current),
      create: jest.fn().mockResolvedValue({ id: 'refresh-new' }),
      sequelize: {
        transaction: (callback: (value: Transaction) => Promise<unknown>) => callback(transaction),
      },
    } as unknown as typeof RefreshToken;
    const service = new AuthService(
      {} as typeof User,
      { findOne: jest.fn().mockResolvedValue(membership) } as unknown as typeof Membership,
      {} as typeof Organization,
      refreshModel,
      {} as Sequelize,
      jwt,
      config,
    );

    const replacement = await service.rotate('r'.repeat(64));

    expect(replacement.refreshToken).not.toBe('r'.repeat(64));
    expect(current.revokedAt).toBeInstanceOf(Date);
    expect(current).toMatchObject({ replacedByTokenId: 'refresh-new' });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('registers a manager without attaching them to a team', async () => {
    const transaction = {} as Transaction;
    const createdUser = {
      ...user,
      name: 'Ana',
      email: 'ana@example.com',
      platformRole: PlatformRole.USER,
    } as User;
    const userCreate = jest.fn().mockResolvedValue(createdUser);
    const service = new AuthService(
      {
        findOne: jest.fn().mockResolvedValue(null),
        create: userCreate,
      } as unknown as typeof User,
      {} as typeof Membership,
      {} as typeof Organization,
      {
        create: jest.fn().mockResolvedValue({ id: 'refresh-a' }),
      } as unknown as typeof RefreshToken,
      {
        transaction: (callback: (value: Transaction) => Promise<unknown>) =>
          callback(transaction),
      } as unknown as Sequelize,
      jwt,
      config,
    );

    const pair = await service.registerManager({
      name: 'Ana',
      email: 'ana@example.com',
      password: '123456',
    });

    expect(pair.accessToken).toBe('signed-access-token');
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({ platformRole: PlatformRole.USER }),
      { transaction },
    );
  });

  it('allows a manager without a membership to create their team', async () => {
    const transaction = {} as Transaction;
    const createdUser = {
      ...user,
      name: 'Ana',
      email: 'ana@example.com',
      platformRole: PlatformRole.USER,
    } as User;
    const createdMembership = {
      ...membership,
      userId: createdUser.id,
      role: MembershipRole.MANAGER,
    } as Membership;
    const organizationCreate = jest.fn().mockResolvedValue({
      id: 'organization-a',
      name: 'Equipe Esperança',
      slug: 'equipe-esperanca',
    });
    const membershipCreate = jest.fn().mockResolvedValue(createdMembership);
    const service = new AuthService(
      {
        findByPk: jest.fn().mockResolvedValue(createdUser),
      } as unknown as typeof User,
      {
        findOne: jest.fn().mockResolvedValue(null),
        create: membershipCreate,
      } as unknown as typeof Membership,
      {
        findOne: jest.fn().mockResolvedValue(null),
        create: organizationCreate,
      } as unknown as typeof Organization,
      {
        create: jest.fn().mockResolvedValue({ id: 'refresh-a' }),
      } as unknown as typeof RefreshToken,
      {
        transaction: (callback: (value: Transaction) => Promise<unknown>) =>
          callback(transaction),
      } as unknown as Sequelize,
      jwt,
      config,
    );

    const pair = await service.createTeam(createdUser.id, {
      teamName: 'Equipe Esperança',
    });

    expect(pair.accessToken).toBe('signed-access-token');
    expect(organizationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Equipe Esperança', slug: 'equipe-esperanca' }),
      { transaction },
    );
    expect(membershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'organization-a',
        userId: createdUser.id,
        role: MembershipRole.MANAGER,
        status: EntityStatus.ACTIVE,
      }),
      { transaction },
    );
  });
});
