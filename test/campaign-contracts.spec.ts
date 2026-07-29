import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  EntityStatus,
  GoalStatus,
  GoalType,
  MembershipRole,
  PlatformRole,
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
  ValidationEvent,
} from '../src/database/models';
import { ActivitiesService } from '../src/modules/activities/activities.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { GoalsService } from '../src/modules/goals/goals.service';
import { StorageService } from '../src/modules/evidences/storage.service';
import { SubmissionsService } from '../src/modules/submissions/submissions.service';
import { TeamSettingsController } from '../src/modules/team-settings/team-settings.controller';
import { TeamSettingsService } from '../src/modules/team-settings/team-settings.service';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { AuthenticatedPrincipal } from '../src/common/auth.types';

function transaction(): Transaction {
  return { LOCK: { UPDATE: 'UPDATE' } } as unknown as Transaction;
}

function submissionsService(): SubmissionsService {
  return new SubmissionsService(
    {} as typeof Submission,
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
}

function ruleActivity(rulesJson: Record<string, unknown>): Activity {
  return {
    minimumQuantity: null,
    minimumParticipants: null,
    minimumParticipationPercent: null,
    rulesJson,
  } as Activity;
}

function ruleSubmission(values: Partial<Submission>): Submission {
  return {
    actionDate: '2026-09-10',
    quantity: null,
    institutionName: null,
    detailsJson: {},
    participants: [],
    items: [],
    ...values,
  } as Submission;
}

describe('official modality rules', () => {
  const service = submissionsService();
  const campaign = {
    startsAt: '2026-08-05',
    endsAt: '2026-12-31',
  } as Campaign;

  it('requires exactly one Christmas letter per active member', () => {
    expect(() =>
      service.assertSubmissionRules(
        ruleSubmission({ quantity: '2' }),
        ruleActivity({ oneLetterPerActiveMember: true }),
        campaign,
        3,
      ),
    ).toThrow('Exactly one letter per active team member is required');
  });

  it('requires the configured duration and institution', () => {
    expect(() =>
      service.assertSubmissionRules(
        ruleSubmission({
          institutionName: 'Lar Esperança',
          detailsJson: { durationMinutes: 59 },
        }),
        ruleActivity({
          minimumDurationMinutes: 60,
          institutionRequired: true,
        }),
        campaign,
        4,
      ),
    ).toThrow('Minimum duration is 60 minutes');
  });

  it('requires at least five positive kit categories', () => {
    expect(() =>
      service.assertSubmissionRules(
        ruleSubmission({
          items: Array.from({ length: 4 }, () => ({ quantity: '2' })) as SubmissionItem[],
        }),
        ruleActivity({ minimumDistinctItems: 5 }),
        campaign,
        4,
      ),
    ).toThrow('At least 5 different item types are required');
  });
});

describe('participant occurrence limits', () => {
  it('blocks an individual who reached the campaign limit', async () => {
    const sequelize = {
      query: jest.fn().mockResolvedValue([
        {
          membershipId: 'membership-a',
          approvedOccurrences: '2',
          approvedOccurrencesThisMonth: '1',
        },
      ]),
    } as unknown as Sequelize;
    const service = new ActivitiesService(
      {} as typeof Activity,
      {} as typeof ActivityItemType,
      {} as typeof Campaign,
      {} as typeof Submission,
      sequelize,
    );

    await expect(
      service.assertParticipantLimits(
        'organization-a',
        {
          id: 'activity-a',
          maxOccurrencesPerParticipant: 2,
          maxOccurrencesPerParticipantPerMonth: null,
        } as Activity,
        ['membership-a'],
        '2026-09-10',
        'submission-a',
        transaction(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('advanced goals', () => {
  const campaign = {
    id: 'campaign-a',
    startsAt: '2026-08-05',
    endsAt: '2026-10-10',
  } as Campaign;

  it('generates one goal per effective campaign month', async () => {
    const tx = transaction();
    const bulkCreate = jest.fn().mockImplementation((values) => Promise.resolve(values));
    const service = new GoalsService(
      { bulkCreate } as unknown as typeof Goal,
      { findOne: jest.fn().mockResolvedValue(campaign) } as unknown as typeof Campaign,
      {} as typeof Activity,
      {
        transaction: (callback: (value: Transaction) => Promise<unknown>) =>
          callback(tx),
      } as unknown as Sequelize,
    );

    const goals = await service.createMonthlyPlan('organization-a', {
      campaignId: campaign.id,
      titlePrefix: 'Plano mensal',
      targetActions: 3,
    });

    expect(goals).toHaveLength(3);
    expect(bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({ startsAt: '2026-08-05', endsAt: '2026-08-31' }),
        expect.objectContaining({ startsAt: '2026-09-01', endsAt: '2026-09-30' }),
        expect.objectContaining({ startsAt: '2026-10-01', endsAt: '2026-10-10' }),
      ],
      { transaction: tx },
    );
  });

  it('calculates progress only from the approved aggregate', async () => {
    const goal = {
      id: 'goal-a',
      organizationId: 'organization-a',
      campaignId: campaign.id,
      activityId: null,
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
      targetPoints: '1000',
      targetActions: 3,
      targetParticipants: 8,
      targetQuantity: '50',
      type: GoalType.CAMPAIGN,
    } as Goal;
    let progressSql = '';
    const query = jest.fn((sql: string) => {
      progressSql = sql;
      return Promise.resolve([
        { points: '500', actions: '2', participants: '5', quantity: '30' },
      ]);
    });
    const service = new GoalsService(
      { findOne: jest.fn().mockResolvedValue(goal) } as unknown as typeof Goal,
      {} as typeof Campaign,
      {} as typeof Activity,
      { query } as unknown as Sequelize,
    );

    const result = await service.progress('organization-a', goal.id);

    expect(result.percentages).toEqual({
      points: 50,
      actions: 67,
      participants: 63,
      quantity: 60,
    });
    expect(result.overallPercentage).toBe(60);
    expect(result.status).toBe(GoalStatus.IN_PROGRESS);
    expect(progressSql).toContain(
      "status IN ('APPROVED', 'PARTIALLY_APPROVED')",
    );
  });

  it('always scopes goal lookup to the organization', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = new GoalsService(
      { findOne } as unknown as typeof Goal,
      {} as typeof Campaign,
      {} as typeof Activity,
      {} as Sequelize,
    );
    await expect(service.findOne('organization-a', 'goal-a')).rejects.toThrow(
      'Goal not found',
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'goal-a', organizationId: 'organization-a' },
    });
  });
});

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
    getClass: () => TeamSettingsController,
  } as unknown as ExecutionContext;
}

describe('team identity permissions and tenant scope', () => {
  const guard = new RolesGuard(new Reflector());
  const updateTheme = Object.getOwnPropertyDescriptor(
    TeamSettingsController.prototype,
    'updateTheme',
  )?.value as (...args: never[]) => unknown;

  it('allows managers and rejects members when changing theme', () => {
    expect(
      guard.canActivate(contextFor(updateTheme, principal(MembershipRole.MANAGER))),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(updateTheme, principal(MembershipRole.MEMBER))),
    ).toThrow(ForbiddenException);
  });

  it('loads only the authenticated organization profile', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'organization-a',
      name: 'Equipe A',
      slug: 'equipe-a',
      primaryColor: '#164E63',
      secondaryColor: '#F59E0B',
      logoKey: null,
      status: EntityStatus.ACTIVE,
    });
    const service = new TeamSettingsService(
      { findOne } as unknown as typeof Organization,
      {} as StorageService,
      {} as AuditService,
      {} as Sequelize,
    );

    await expect(service.find('organization-a')).resolves.toMatchObject({
      id: 'organization-a',
      hasLogo: false,
    });
    expect(findOne).toHaveBeenCalledWith({ where: { id: 'organization-a' } });
  });
});
