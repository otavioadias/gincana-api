import { BadRequestException } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  ActivityStatus,
  AvailabilityBlockScope,
  SubmissionStatus,
} from '../src/common/enums';
import {
  Activity,
  ActivityItemType,
  Campaign,
  Evidence,
  Membership,
  Submission,
  SubmissionItem,
  SubmissionParticipant,
  ValidationEvent,
} from '../src/database/models';
import { ActivitiesService } from '../src/modules/activities/activities.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { SubmissionsService } from '../src/modules/submissions/submissions.service';

const campaign = {
  id: 'campaign-a',
  startsAt: '2026-08-05',
  endsAt: '2026-12-31',
} as Campaign;

function available() {
  return {
    available: true,
    reason: null,
    blockScope: null,
    blockedUntil: null,
    approvedOccurrences: 0,
    approvedOccurrencesThisMonth: 0,
    remainingOccurrences: null,
    remainingOccurrencesThisMonth: null,
  };
}

function activityAvailability(
  counts: number[],
  activity: Partial<Activity>,
  actionDate = '2026-09-20',
): ReturnType<ActivitiesService['availability']> {
  const service = new ActivitiesService(
    {} as typeof Activity,
    {} as typeof ActivityItemType,
    { findOne: jest.fn().mockResolvedValue(campaign) } as unknown as typeof Campaign,
    { count: jest.fn().mockImplementation(() => Promise.resolve(counts.shift() ?? 0)) } as unknown as typeof Submission,
    {} as Sequelize,
  );
  return service.availability('organization-a', {
      id: 'activity-a',
      campaignId: campaign.id,
      campaign,
      status: ActivityStatus.ACTIVE,
      maxOccurrences: null,
      maxOccurrencesPerMonth: null,
      ...activity,
    } as Activity, actionDate);
}

describe('submission limits and partial approval', () => {
  it('creates a draft in one transaction and includes its author by default', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } } as unknown as Transaction;
    const draft = { id: 'submission-a', activityId: 'activity-a' } as Submission;
    const participantsBulkCreate = jest.fn().mockResolvedValue([]);
    const service = new SubmissionsService(
      {
        create: jest.fn().mockResolvedValue(draft),
        findOne: jest.fn().mockResolvedValue(draft),
      } as unknown as typeof Submission,
      { destroy: jest.fn().mockResolvedValue(0) } as unknown as typeof SubmissionItem,
      {
        destroy: jest.fn().mockResolvedValue(0),
        bulkCreate: participantsBulkCreate,
      } as unknown as typeof SubmissionParticipant,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'activity-a',
          unit: 'kg',
          status: ActivityStatus.ACTIVE,
        }),
      } as unknown as typeof Activity,
      {} as typeof ActivityItemType,
      { findOne: jest.fn().mockResolvedValue(campaign) } as unknown as typeof Campaign,
      {
        findOne: jest.fn().mockResolvedValue({ id: 'membership-a' }),
        findAll: jest.fn().mockResolvedValue([{ id: 'membership-a' }]),
      } as unknown as typeof Membership,
      {} as typeof Evidence,
      {} as typeof ValidationEvent,
      {
        transaction: (callback: (value: Transaction) => Promise<unknown>) =>
          callback(transaction),
      } as unknown as Sequelize,
      {
        availability: jest.fn().mockResolvedValue(available()),
      } as unknown as ActivitiesService,
      {} as AuditService,
    );

    await service.create('organization-a', 'user-a', {
      campaignId: 'campaign-a',
      activityId: 'activity-a',
      actionDate: '2026-09-20',
    });

    expect(participantsBulkCreate).toHaveBeenCalledWith(
      [{ submissionId: 'submission-a', membershipId: 'membership-a' }],
      { transaction },
    );
  });

  it('blocks the team when the campaign occurrence limit is reached', async () => {
    await expect(
      activityAvailability([1, 1, 0], { maxOccurrences: 1 }),
    ).resolves.toMatchObject({
      available: false,
      reason: 'Maximum reached',
      blockScope: AvailabilityBlockScope.CAMPAIGN,
      approvedOccurrences: 1,
      remainingOccurrences: 0,
    });
  });

  it('blocks only until next month when the monthly limit is reached', async () => {
    await expect(
      activityAvailability([4, 2, 0], { maxOccurrencesPerMonth: 2 }),
    ).resolves.toMatchObject({
      available: false,
      reason: 'Maximum reached',
      blockScope: AvailabilityBlockScope.MONTH,
      blockedUntil: '2026-10-01',
      approvedOccurrences: 4,
      approvedOccurrencesThisMonth: 2,
      remainingOccurrencesThisMonth: 0,
    });
  });

  it('blocks another submission of the same activity on the same date', async () => {
    await expect(activityAvailability([1, 1, 1], {})).resolves.toMatchObject({
      available: false,
      blockScope: AvailabilityBlockScope.DATE,
      blockedUntil: '2026-09-20',
    });
  });

  it('does not derive a hidden limit from the legacy repeatable flag', async () => {
    await expect(
      activityAvailability([12, 2, 0], { repeatable: false }),
    ).resolves.toMatchObject({
      available: true,
      approvedOccurrences: 12,
    });
  });

  it('allows an action before the configured campaign start date', async () => {
    await expect(
      activityAvailability([0, 0, 0], {}, '2026-07-29'),
    ).resolves.toMatchObject({
      available: true,
      reason: null,
    });
  });

  it('requires a reason for partial approval', async () => {
    const service = createValidationService({} as typeof Submission);
    await expect(
      service.validate('submission-a', 'validator-a', {
        status: SubmissionStatus.PARTIALLY_APPROVED,
        approvedPoints: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revalidates under an activity row lock before partial approval', async () => {
    let updateTransaction: Transaction | undefined;
    const update = jest.fn(
      (_values: object, options: { transaction: Transaction }) => {
        updateTransaction = options.transaction;
        return Promise.resolve(undefined);
      },
    );
    const submission = {
      id: 'submission-a',
      organizationId: 'organization-a',
      activityId: 'activity-a',
      createdBy: 'member-a',
      actionDate: '2026-09-20',
      status: SubmissionStatus.SUBMITTED,
      calculatedPoints: '300',
      approvedPoints: '0',
      update,
    } as unknown as Submission;
    const activityFindOne = jest.fn().mockResolvedValue({
      id: 'activity-a',
      rulesJson: {},
    });
    const availability = jest.fn().mockResolvedValue(available());
    const service = createValidationService(
      { findOne: jest.fn().mockResolvedValue(submission) } as unknown as typeof Submission,
      activityFindOne,
      availability,
    );

    await service.validate('submission-a', 'validator-a', {
      status: SubmissionStatus.PARTIALLY_APPROVED,
      approvedPoints: 125,
      reason: 'Only part of the evidence was accepted.',
    });

    expect(activityFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: 'UPDATE' }),
    );
    expect(availability).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      {
        status: SubmissionStatus.PARTIALLY_APPROVED,
        approvedPoints: '125',
      },
      { transaction: updateTransaction },
    );
    expect(updateTransaction).toBeDefined();
  });
});

function createValidationService(
  submissions: typeof Submission,
  activityFindOne = jest.fn(),
  availability = jest.fn(),
): SubmissionsService {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } } as unknown as Transaction;
  return new SubmissionsService(
    submissions,
    {} as typeof SubmissionItem,
    {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as typeof SubmissionParticipant,
    { findOne: activityFindOne } as unknown as typeof Activity,
    {} as typeof ActivityItemType,
    {} as typeof Campaign,
    { count: jest.fn().mockResolvedValue(0) } as unknown as typeof Membership,
    {} as typeof Evidence,
    { create: jest.fn().mockResolvedValue(undefined) } as unknown as typeof ValidationEvent,
    {
      transaction: (callback: (value: Transaction) => Promise<unknown>) =>
        callback(transaction),
    } as unknown as Sequelize,
    {
      availability,
      assertParticipantLimits: jest.fn().mockResolvedValue(undefined),
    } as unknown as ActivitiesService,
    { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
  );
}
