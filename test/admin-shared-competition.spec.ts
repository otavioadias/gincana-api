import { ConfigService } from '@nestjs/config';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  EntityStatus,
  MembershipRole,
  SubmissionStatus,
} from '../src/common/enums';
import {
  Activity,
  ActivityItemType,
  Campaign,
  Evidence,
  Goal,
  Membership,
  Organization,
  Submission,
  SubmissionItem,
  SubmissionParticipant,
  User,
  ValidationEvent,
} from '../src/database/models';
import { ActivitiesService } from '../src/modules/activities/activities.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { DashboardsService } from '../src/modules/dashboards/dashboards.service';
import { MembersService } from '../src/modules/members/members.service';
import { GoalsService } from '../src/modules/goals/goals.service';
import { SubmissionsService } from '../src/modules/submissions/submissions.service';

describe('shared competition and admin visibility', () => {
  it('lists shared activities while calculating availability for one team', async () => {
    const activity = {
      id: 'activity-a',
      campaignId: 'campaign-a',
      organizationId: null,
      campaign: {
        id: 'campaign-a',
        startsAt: '2026-08-05',
        endsAt: '2026-12-31',
      },
      status: 'ACTIVE',
      maxOccurrences: null,
      maxOccurrencesPerMonth: null,
    } as Activity;
    const activityFindAll = jest.fn().mockResolvedValue([activity]);
    let countedOrganization: unknown;
    const count = jest.fn((options: { where: Record<string, unknown> }) => {
      countedOrganization = options.where.organizationId;
      return Promise.resolve(0);
    });
    const service = new ActivitiesService(
      { findAll: activityFindAll } as unknown as typeof Activity,
      {} as typeof ActivityItemType,
      {} as typeof Campaign,
      { count } as unknown as typeof Submission,
      {} as Sequelize,
    );

    const result = await service.findAll(
      'organization-a',
      'campaign-a',
      '2026-09-20',
    );

    expect(activityFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: null, campaignId: 'campaign-a' },
      }),
    );
    expect(result[0].availability).toMatchObject({ available: true });
    expect(count).toHaveBeenCalled();
    expect(countedOrganization).toBe('organization-a');
  });

  it('lets the admin filter every team submission by team and campaign', async () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const service = new SubmissionsService(
      { findAll } as unknown as typeof Submission,
      {} as typeof SubmissionItem,
      {} as typeof SubmissionParticipant,
      {} as typeof Activity,
      {} as typeof ActivityItemType,
      {} as typeof Campaign,
      {} as typeof Membership,
      {} as typeof Evidence,
      {} as typeof ValidationEvent,
      {} as Sequelize,
      {} as ActivitiesService,
      {} as AuditService,
    );

    await service.findAllForAdmin(
      SubmissionStatus.APPROVED,
      'organization-a',
      'campaign-a',
    );

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'organization-a',
          campaignId: 'campaign-a',
          status: SubmissionStatus.APPROVED,
        },
      }),
    );
  });

  it('returns progress for every active team to the admin', async () => {
    const teams = [
      { id: 'organization-a', name: 'Equipe A', slug: 'equipe-a' },
      { id: 'organization-b', name: 'Equipe B', slug: 'equipe-b' },
    ] as Organization[];
    const service = new DashboardsService(
      {} as Sequelize,
      {} as typeof Submission,
      {} as typeof Goal,
      { findAll: jest.fn().mockResolvedValue(teams) } as unknown as typeof Organization,
      {} as GoalsService,
    );
    jest
      .spyOn(service, 'summary')
      .mockImplementation((organizationId) =>
        Promise.resolve({ organizationId, approvedPoints: 100 }),
      );

    const result = await service.adminTeams('admin-a', 'campaign-a');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      team: { id: 'organization-a', name: 'Equipe A' },
      approvedPoints: 100,
    });
  });
});

describe('multiple managers per team', () => {
  it('allows an existing member to be promoted to a second manager', async () => {
    const transaction = {} as Transaction;
    const update = jest.fn().mockResolvedValue(undefined);
    const membership = {
      id: 'membership-b',
      organizationId: 'organization-a',
      userId: 'user-b',
      role: MembershipRole.MEMBER,
      status: EntityStatus.ACTIVE,
      update,
    } as unknown as Membership;
    const service = new MembersService(
      {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(membership)
          .mockResolvedValueOnce(membership),
      } as unknown as typeof Membership,
      { update: jest.fn().mockResolvedValue([0]) } as unknown as typeof User,
      {
        transaction: (callback: (value: Transaction) => Promise<unknown>) =>
          callback(transaction),
      } as unknown as Sequelize,
      {} as ConfigService,
    );

    await service.update('organization-a', membership.id, {
      role: MembershipRole.MANAGER,
    });

    expect(update).toHaveBeenCalledWith(
      { role: MembershipRole.MANAGER },
      { transaction },
    );
  });
});
