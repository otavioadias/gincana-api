import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  ActivityStatus,
  AvailabilityBlockScope,
  SubmissionStatus,
} from '../../common/enums';
import { Activity, ActivityItemType, Campaign, Submission } from '../../database/models';
import {
  ActivityAvailabilityDto,
  ActivityItemTypeDto,
  CreateActivityDto,
  UpdateActivityDto,
} from './activities.dto';

export interface ActivityWithAvailability {
  activity: Activity;
  availability: ActivityAvailabilityDto;
}

const APPROVED_STATUSES = [
  SubmissionStatus.APPROVED,
  SubmissionStatus.PARTIALLY_APPROVED,
];

const NON_TERMINAL_DUPLICATE_STATUSES = [
  SubmissionStatus.DRAFT,
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.NEEDS_CHANGES,
  SubmissionStatus.APPROVED,
  SubmissionStatus.PARTIALLY_APPROVED,
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds(actionDate: string): { start: string; next: string } {
  const [year, month] = actionDate.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    next: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity) private readonly activities: typeof Activity,
    @InjectModel(ActivityItemType) private readonly itemTypes: typeof ActivityItemType,
    @InjectModel(Campaign) private readonly campaigns: typeof Campaign,
    @InjectModel(Submission) private readonly submissions: typeof Submission,
    private readonly sequelize: Sequelize,
  ) {}

  async findAll(
    organizationId: string,
    campaignId?: string,
    actionDate = today(),
  ): Promise<ActivityWithAvailability[]> {
    const activities = await this.activities.findAll({
      where: { organizationId, ...(campaignId ? { campaignId } : {}) },
      include: [ActivityItemType, Campaign],
      order: [['name', 'ASC']],
    });
    return Promise.all(
      activities.map(async (activity) => ({
        activity,
        availability: await this.availability(organizationId, activity, actionDate),
      })),
    );
  }

  async findOne(
    organizationId: string,
    id: string,
    transaction?: Transaction,
    lock?: Transaction['LOCK']['UPDATE'],
  ): Promise<Activity> {
    const activity = await this.activities.findOne({
      where: { id, organizationId },
      include: [ActivityItemType, Campaign],
      transaction,
      ...(lock ? { lock } : {}),
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async create(organizationId: string, input: CreateActivityDto): Promise<Activity> {
    await this.assertCampaign(organizationId, input.campaignId);
    return this.sequelize.transaction(async (transaction) => {
      const activity = await this.activities.create(
        {
          organizationId,
          campaignId: input.campaignId,
          name: input.name,
          description: input.description ?? null,
          scoringType: input.scoringType,
          points: String(input.points ?? 0),
          unit: input.unit ?? null,
          minimumQuantity:
            input.minimumQuantity == null ? null : String(input.minimumQuantity),
          minimumParticipants: input.minimumParticipants ?? null,
          minimumParticipationPercent:
            input.minimumParticipationPercent == null
              ? null
              : String(input.minimumParticipationPercent),
          maxOccurrences: input.maxOccurrences ?? null,
          maxOccurrencesPerMonth: input.maxOccurrencesPerMonth ?? null,
          maxOccurrencesPerParticipant: input.maxOccurrencesPerParticipant ?? null,
          maxOccurrencesPerParticipantPerMonth:
            input.maxOccurrencesPerParticipantPerMonth ?? null,
          repeatable: input.repeatable ?? true,
          evidenceRequired: input.evidenceRequired ?? true,
          rulesJson: input.rulesJson ?? {},
          status: input.status ?? ActivityStatus.ACTIVE,
        },
        { transaction },
      );
      await this.replaceItems(activity.id, input.itemTypes ?? [], transaction);
      return this.findOne(organizationId, activity.id, transaction);
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateActivityDto,
  ): Promise<Activity> {
    const activity = await this.findOne(organizationId, id);
    if (input.campaignId) await this.assertCampaign(organizationId, input.campaignId);
    await this.sequelize.transaction(async (transaction) => {
      await activity.update(
        {
          ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.scoringType !== undefined ? { scoringType: input.scoringType } : {}),
          ...(input.points !== undefined ? { points: String(input.points) } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.minimumQuantity !== undefined
            ? {
                minimumQuantity:
                  input.minimumQuantity === null ? null : String(input.minimumQuantity),
              }
            : {}),
          ...(input.minimumParticipants !== undefined
            ? { minimumParticipants: input.minimumParticipants }
            : {}),
          ...(input.minimumParticipationPercent !== undefined
            ? {
                minimumParticipationPercent:
                  input.minimumParticipationPercent === null
                    ? null
                    : String(input.minimumParticipationPercent),
              }
            : {}),
          ...(input.maxOccurrences !== undefined
            ? { maxOccurrences: input.maxOccurrences }
            : {}),
          ...(input.maxOccurrencesPerMonth !== undefined
            ? { maxOccurrencesPerMonth: input.maxOccurrencesPerMonth }
            : {}),
          ...(input.maxOccurrencesPerParticipant !== undefined
            ? { maxOccurrencesPerParticipant: input.maxOccurrencesPerParticipant }
            : {}),
          ...(input.maxOccurrencesPerParticipantPerMonth !== undefined
            ? {
                maxOccurrencesPerParticipantPerMonth:
                  input.maxOccurrencesPerParticipantPerMonth,
              }
            : {}),
          ...(input.repeatable !== undefined ? { repeatable: input.repeatable } : {}),
          ...(input.evidenceRequired !== undefined
            ? { evidenceRequired: input.evidenceRequired }
            : {}),
          ...(input.rulesJson !== undefined ? { rulesJson: input.rulesJson } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        { transaction },
      );
      if (input.itemTypes) await this.replaceItems(id, input.itemTypes, transaction);
    });
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const activity = await this.findOne(organizationId, id);
    await activity.update({ status: ActivityStatus.INACTIVE });
  }

  async availabilityById(
    organizationId: string,
    id: string,
    actionDate: string,
  ): Promise<ActivityAvailabilityDto> {
    return this.availability(
      organizationId,
      await this.findOne(organizationId, id),
      actionDate,
    );
  }

  async availability(
    organizationId: string,
    activity: Activity,
    actionDate = today(),
    excludeSubmissionId?: string,
    transaction?: Transaction,
  ): Promise<ActivityAvailabilityDto> {
    const campaign =
      activity.campaign ??
      (await this.campaigns.findOne({
        where: { id: activity.campaignId, organizationId },
        transaction,
      }));
    if (!campaign) throw new BadRequestException('Campaign not found');
    const { start, next } = monthBounds(actionDate);
    const commonWhere = {
      organizationId,
      activityId: activity.id,
      status: { [Op.in]: APPROVED_STATUSES },
      ...(excludeSubmissionId ? { id: { [Op.ne]: excludeSubmissionId } } : {}),
    };
    const [approvedOccurrences, approvedOccurrencesThisMonth, sameDate] =
      await Promise.all([
        this.submissions.count({ where: commonWhere, transaction }),
        this.submissions.count({
          where: {
            ...commonWhere,
            actionDate: { [Op.gte]: start, [Op.lt]: next },
          },
          transaction,
        }),
        this.submissions.count({
          where: {
            organizationId,
            activityId: activity.id,
            actionDate,
            status: { [Op.in]: NON_TERMINAL_DUPLICATE_STATUSES },
            ...(excludeSubmissionId ? { id: { [Op.ne]: excludeSubmissionId } } : {}),
          },
          transaction,
        }),
      ]);
    const result: ActivityAvailabilityDto = {
      available: true,
      reason: null,
      blockScope: null,
      blockedUntil: null,
      approvedOccurrences,
      approvedOccurrencesThisMonth,
      remainingOccurrences:
        activity.maxOccurrences == null
          ? null
          : Math.max(activity.maxOccurrences - approvedOccurrences, 0),
      remainingOccurrencesThisMonth:
        activity.maxOccurrencesPerMonth == null
          ? null
          : Math.max(
              activity.maxOccurrencesPerMonth - approvedOccurrencesThisMonth,
              0,
            ),
    };
    if (activity.status === ActivityStatus.INACTIVE) {
      return {
        ...result,
        available: false,
        reason: 'Activity is inactive',
        blockScope: AvailabilityBlockScope.CAMPAIGN,
        blockedUntil: campaign.endsAt,
      };
    }
    if (actionDate > campaign.endsAt) {
      return {
        ...result,
        available: false,
        reason: 'Action date is outside the campaign period',
        blockScope: AvailabilityBlockScope.CAMPAIGN,
        blockedUntil: campaign.endsAt,
      };
    }
    if (sameDate > 0) {
      return {
        ...result,
        available: false,
        reason: 'An occurrence of this activity already exists on this date',
        blockScope: AvailabilityBlockScope.DATE,
        blockedUntil: actionDate,
      };
    }
    if (
      activity.maxOccurrences != null &&
      approvedOccurrences >= activity.maxOccurrences
    ) {
      return {
        ...result,
        available: false,
        reason: 'Maximum reached',
        blockScope: AvailabilityBlockScope.CAMPAIGN,
        blockedUntil: campaign.endsAt,
      };
    }
    if (
      activity.maxOccurrencesPerMonth != null &&
      approvedOccurrencesThisMonth >= activity.maxOccurrencesPerMonth
    ) {
      return {
        ...result,
        available: false,
        reason: 'Maximum reached',
        blockScope: AvailabilityBlockScope.MONTH,
        blockedUntil: next,
      };
    }
    return result;
  }

  async assertParticipantLimits(
    organizationId: string,
    activity: Activity,
    participantIds: string[],
    actionDate: string,
    excludeSubmissionId: string,
    transaction: Transaction,
  ): Promise<void> {
    if (
      participantIds.length === 0 ||
      (activity.maxOccurrencesPerParticipant == null &&
        activity.maxOccurrencesPerParticipantPerMonth == null)
    ) {
      return;
    }
    const { start, next } = monthBounds(actionDate);
    const rows = await this.sequelize.query<{
      membershipId: string;
      approvedOccurrences: string;
      approvedOccurrencesThisMonth: string;
    }>(
      `
        SELECT
          sp.membership_id AS "membershipId",
          COUNT(*)::text AS "approvedOccurrences",
          COUNT(*) FILTER (
            WHERE s.action_date >= :monthStart AND s.action_date < :nextMonth
          )::text AS "approvedOccurrencesThisMonth"
        FROM submission_participants sp
        INNER JOIN submissions s ON s.id = sp.submission_id
        WHERE sp.membership_id IN (:participantIds)
          AND s.organization_id = :organizationId
          AND s.activity_id = :activityId
          AND s.id <> :excludeSubmissionId
          AND s.status IN ('APPROVED', 'PARTIALLY_APPROVED')
        GROUP BY sp.membership_id
      `,
      {
        replacements: {
          participantIds,
          organizationId,
          activityId: activity.id,
          excludeSubmissionId,
          monthStart: start,
          nextMonth: next,
        },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    for (const row of rows) {
      if (
        activity.maxOccurrencesPerParticipant != null &&
        Number(row.approvedOccurrences) >= activity.maxOccurrencesPerParticipant
      ) {
        throw new BadRequestException(
          `Participant ${row.membershipId} reached the campaign limit`,
        );
      }
      if (
        activity.maxOccurrencesPerParticipantPerMonth != null &&
        Number(row.approvedOccurrencesThisMonth) >=
          activity.maxOccurrencesPerParticipantPerMonth
      ) {
        throw new BadRequestException(
          `Participant ${row.membershipId} reached the monthly limit`,
        );
      }
    }
  }

  private async assertCampaign(
    organizationId: string,
    campaignId: string,
  ): Promise<void> {
    const campaign = await this.campaigns.findOne({
      where: { id: campaignId, organizationId },
    });
    if (!campaign) {
      throw new BadRequestException(
        'Campaign does not belong to the authenticated organization',
      );
    }
  }

  private async replaceItems(
    activityId: string,
    items: ActivityItemTypeDto[],
    transaction: Transaction,
  ): Promise<void> {
    await this.itemTypes.destroy({ where: { activityId }, transaction });
    if (items.length) {
      await this.itemTypes.bulkCreate(
        items.map((item) => ({
          activityId,
          name: item.name,
          pointsPerUnit: String(item.pointsPerUnit),
          unit: item.unit,
          minimumQuantity:
            item.minimumQuantity === undefined
              ? null
              : String(item.minimumQuantity),
        })),
        { transaction },
      );
    }
  }
}
