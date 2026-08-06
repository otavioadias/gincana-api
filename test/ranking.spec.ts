import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import {
  MembershipRole,
  PlatformRole,
} from '../src/common/enums';
import { AuthenticatedPrincipal } from '../src/common/auth.types';
import { Organization } from '../src/database/models';
import { RankingsService } from '../src/modules/dashboards/rankings.service';
import { StorageService } from '../src/modules/evidences/storage.service';

describe('RankingsService', () => {
  it('returns the global ranking with signed photos and approved points', async () => {
    let rankingSql = '';
    let rankingOptions: unknown;
    const query = jest.fn((sql: string, options: unknown) => {
      rankingSql = sql;
      rankingOptions = options;
      return Promise.resolve([
        {
          organizationId: 'organization-red',
          name: 'Red',
          slug: 'red',
          logoKey: 'teams/red/logo.webp',
          points: '6730.00',
          lastUpdatedAt: new Date('2026-12-20T12:00:00.000Z'),
        },
        {
          organizationId: 'organization-blue',
          name: 'Azul',
          slug: 'azul',
          logoKey: null,
          points: '4685.00',
          lastUpdatedAt: '2026-12-19T10:00:00.000Z',
        },
      ]);
    });
    const signedReadUrl = jest
      .fn()
      .mockResolvedValue('https://storage.test/logo');
    const storage = { signedReadUrl } as unknown as StorageService;
    const service = new RankingsService(
      { query } as unknown as Sequelize,
      storage,
      {} as typeof Organization,
    );

    await expect(service.findAll('campaign-a')).resolves.toEqual([
      {
        position: 1,
        organizationId: 'organization-red',
        name: 'Red',
        slug: 'red',
        photoUrl: 'https://storage.test/logo',
        points: 6730,
        lastUpdatedAt: '2026-12-20T12:00:00.000Z',
      },
      {
        position: 2,
        organizationId: 'organization-blue',
        name: 'Azul',
        slug: 'azul',
        photoUrl: null,
        points: 4685,
        lastUpdatedAt: '2026-12-19T10:00:00.000Z',
      },
    ]);
    expect(rankingSql).toContain(
      "submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')",
    );
    expect(rankingSql).toContain("organization.status = 'ACTIVE'");
    expect(rankingOptions).toMatchObject({
      replacements: { campaignId: 'campaign-a' },
    });
    expect(signedReadUrl).toHaveBeenCalledWith('teams/red/logo.webp');
  });

  it('uses the authenticated user team for the member ranking', async () => {
    let rankingSql = '';
    let rankingOptions: unknown;
    const query = jest.fn((sql: string, options: unknown) => {
      rankingSql = sql;
      rankingOptions = options;
      return Promise.resolve([
        {
          membershipId: 'membership-a',
          userId: 'user-a',
          name: 'Ana',
          points: '850.00',
          approvedActions: '3',
          lastUpdatedAt: '2026-10-10T12:00:00.000Z',
        },
      ]);
    });
    const organization = {
      id: 'organization-a',
      name: 'Equipe A',
      slug: 'equipe-a',
    } as Organization;
    const service = new RankingsService(
      { query } as unknown as Sequelize,
      {} as StorageService,
      {
        findOne: jest.fn().mockResolvedValue(organization),
      } as unknown as typeof Organization,
    );
    const user = principal(PlatformRole.USER, 'organization-a');

    await expect(service.findMembers(user, undefined, 'campaign-a')).resolves.toEqual({
      team: {
        id: 'organization-a',
        name: 'Equipe A',
        slug: 'equipe-a',
      },
      ranking: [
        {
          position: 1,
          membershipId: 'membership-a',
          userId: 'user-a',
          name: 'Ana',
          points: 850,
          approvedActions: 3,
          lastUpdatedAt: '2026-10-10T12:00:00.000Z',
        },
      ],
    });
    expect(rankingSql).toContain('submission.created_by = member.id');
    expect(rankingSql).toContain(
      "submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')",
    );
    expect(rankingOptions).toMatchObject({
      replacements: {
        organizationId: 'organization-a',
        campaignId: 'campaign-a',
      },
    });
  });

  it('prevents a team user from viewing another team', async () => {
    const service = new RankingsService(
      {} as Sequelize,
      {} as StorageService,
      {} as typeof Organization,
    );

    await expect(
      service.findMembers(
        principal(PlatformRole.USER, 'organization-a'),
        'organization-b',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires admins to select a team', async () => {
    const service = new RankingsService(
      {} as Sequelize,
      {} as StorageService,
      {} as typeof Organization,
    );

    await expect(
      service.findMembers(principal(PlatformRole.ADMIN, null)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function principal(
  platformRole: PlatformRole,
  organizationId: string | null,
): AuthenticatedPrincipal {
  return {
    userId: 'current-user',
    email: 'current@example.com',
    platformRole,
    organizationId,
    membershipId: organizationId ? 'current-membership' : null,
    membershipRole: organizationId ? MembershipRole.MEMBER : null,
  };
}
