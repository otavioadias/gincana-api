import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { ActivityStatus, EntityStatus, SubmissionStatus } from '../../common/enums';
import {
  Activity,
  ActivityItemType,
  Campaign,
  Evidence,
  Membership,
  Organization,
  Submission,
  SubmissionItem,
  SubmissionParticipant,
  ValidationEvent,
} from '../../database/models';
import { AuditService } from '../audit/audit.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  CreateSubmissionDto,
  SubmissionItemDto,
  UpdateSubmissionDto,
  ValidateSubmissionDto,
} from './submissions.dto';
import { ScoringEngine } from './scoring.engine';

@Injectable()
export class SubmissionsService {
  private readonly scoring = new ScoringEngine();

  constructor(
    @InjectModel(Submission) private readonly submissions: typeof Submission,
    @InjectModel(SubmissionItem) private readonly items: typeof SubmissionItem,
    @InjectModel(SubmissionParticipant) private readonly participants: typeof SubmissionParticipant,
    @InjectModel(Activity) private readonly activities: typeof Activity,
    @InjectModel(ActivityItemType) private readonly itemTypes: typeof ActivityItemType,
    @InjectModel(Campaign) private readonly campaigns: typeof Campaign,
    @InjectModel(Membership) private readonly memberships: typeof Membership,
    @InjectModel(Evidence) private readonly evidences: typeof Evidence,
    @InjectModel(ValidationEvent) private readonly validationEvents: typeof ValidationEvent,
    private readonly sequelize: Sequelize,
    private readonly activitiesService: ActivitiesService,
    private readonly audit: AuditService,
  ) {}

  findAll(organizationId: string, status?: SubmissionStatus): Promise<Submission[]> {
    return this.submissions.findAll({
      where: { organizationId, ...(status ? { status } : {}) },
      include: [Activity, SubmissionItem, SubmissionParticipant, Evidence],
      order: [['createdAt', 'DESC']],
    });
  }

  findAllForValidation(status?: SubmissionStatus): Promise<Submission[]> {
    return this.submissions.findAll({
      where: {
        ...(status ? { status } : {
          status: {
            [Op.in]: [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW],
          },
        }),
      },
      include: [
        Organization,
        Activity,
        SubmissionItem,
        SubmissionParticipant,
        Evidence,
      ],
      order: [['createdAt', 'ASC']],
    });
  }

  async findOneForValidation(id: string): Promise<Submission> {
    const submission = await this.submissions.findOne({
      where: { id },
      include: [
        Organization,
        { model: Activity, include: [ActivityItemType] },
        Campaign,
        { model: SubmissionItem, include: [ActivityItemType] },
        SubmissionParticipant,
        Evidence,
      ],
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async findOne(
    organizationId: string,
    id: string,
    transaction?: Transaction,
  ): Promise<Submission> {
    const submission = await this.submissions.findOne({
      where: { id, organizationId },
      include: [
        { model: Activity, include: [ActivityItemType] },
        Campaign,
        { model: SubmissionItem, include: [ActivityItemType] },
        SubmissionParticipant,
        Evidence,
      ],
      transaction,
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateSubmissionDto,
  ): Promise<Submission> {
    const { campaign, activity } = await this.assertReferences(
      organizationId,
      input.campaignId,
      input.activityId,
    );
    try {
      return await this.sequelize.transaction(async (transaction) => {
        const actionDate = input.actionDate.slice(0, 10);
        const lockedActivity = await this.activities.findOne({
          where: { id: activity.id, campaignId: campaign.id, organizationId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!lockedActivity) throw new BadRequestException('Activity not found');
        const availability = await this.activitiesService.availability(
          organizationId,
          lockedActivity,
          actionDate,
          undefined,
          transaction,
        );
        if (!availability.available) {
          throw new BadRequestException(availability.reason);
        }
        const participantIds = input.participantIds?.length
          ? input.participantIds
          : await this.creatorMembershipIds(organizationId, userId, transaction);
        const submission = await this.submissions.create(
          {
            organizationId,
            campaignId: campaign.id,
            activityId: activity.id,
            createdBy: userId,
            actionDate,
            institutionName: input.institutionName ?? null,
            quantity: input.quantity === undefined ? null : String(input.quantity),
            unit: input.unit ?? lockedActivity.unit,
            detailsJson: input.details ? { ...input.details } : {},
            status: SubmissionStatus.DRAFT,
            calculatedPoints: '0',
            approvedPoints: '0',
            notes: input.notes ?? null,
          },
          { transaction },
        );
        await this.replaceRelations(
          organizationId,
          submission,
          input.items ?? [],
          participantIds,
          transaction,
        );
        return this.findOne(organizationId, submission.id, transaction);
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new BadRequestException(
          'An occurrence of this activity already exists on this date',
        );
      }
      throw error;
    }
  }

  async update(
    organizationId: string,
    id: string,
    userId: string,
    input: UpdateSubmissionDto,
  ): Promise<Submission> {
    const submission = await this.findOne(organizationId, id);
    if (submission.status !== SubmissionStatus.DRAFT && submission.status !== SubmissionStatus.NEEDS_CHANGES) {
      throw new BadRequestException('Only drafts or submissions needing changes can be edited');
    }
    if (submission.createdBy !== userId) throw new ForbiddenException('Only the author can edit this submission');
    const campaignId = input.campaignId ?? submission.campaignId;
    const activityId = input.activityId ?? submission.activityId;
    await this.assertReferences(organizationId, campaignId, activityId);
    try {
      await this.sequelize.transaction(async (transaction) => {
        const actionDate = input.actionDate?.slice(0, 10) ?? submission.actionDate;
        const activity = await this.activities.findOne({
          where: { id: activityId, campaignId, organizationId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!activity) throw new BadRequestException('Activity not found');
        const availability = await this.activitiesService.availability(
          organizationId,
          activity,
          actionDate,
          submission.id,
          transaction,
        );
        if (!availability.available) {
          throw new BadRequestException(availability.reason);
        }
        await submission.update(
          {
            campaignId,
            activityId,
            ...(input.institutionName !== undefined
              ? { institutionName: input.institutionName }
              : {}),
            ...(input.unit !== undefined ? { unit: input.unit } : {}),
            ...(input.details !== undefined
              ? { detailsJson: { ...input.details } }
              : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(input.actionDate ? { actionDate } : {}),
            ...(input.quantity !== undefined ? { quantity: String(input.quantity) } : {}),
          },
          { transaction },
        );
        if (input.items || input.participantIds) {
          await this.replaceRelations(
            organizationId,
            submission,
            input.items ??
              submission.items?.map((item) => ({
                activityItemTypeId: item.activityItemTypeId,
                quantity: Number(item.quantity),
              })) ??
              [],
            input.participantIds ??
              submission.participants?.map((item) => item.membershipId) ??
              [],
            transaction,
          );
        }
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new BadRequestException(
          'An occurrence of this activity already exists on this date',
        );
      }
      throw error;
    }
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string, userId: string): Promise<void> {
    const submission = await this.findOne(organizationId, id);
    if (submission.createdBy !== userId || submission.status !== SubmissionStatus.DRAFT) {
      throw new ForbiddenException('Only the author can delete a draft');
    }
    await submission.destroy();
  }

  async submit(organizationId: string, id: string, userId: string): Promise<Submission> {
    const submission = await this.findOne(organizationId, id);
    if (submission.createdBy !== userId) throw new ForbiddenException('Only the author can submit');
    if (![SubmissionStatus.DRAFT, SubmissionStatus.NEEDS_CHANGES].includes(submission.status)) {
      throw new BadRequestException('Submission is not editable');
    }
    const activity = submission.activity!;
    const campaign = submission.campaign!;
    const participantIds =
      submission.participants?.map((participant) => participant.membershipId) ?? [];
    const activeSubmittedParticipants = participantIds.length
      ? await this.memberships.count({
          where: {
            id: { [Op.in]: participantIds },
            organizationId,
            status: EntityStatus.ACTIVE,
          },
        })
      : 0;
    if (activeSubmittedParticipants !== participantIds.length) {
      throw new BadRequestException(
        'All participants must be active members of the team',
      );
    }
    const activeMemberCount = await this.memberships.count({
      where: { organizationId, status: EntityStatus.ACTIVE },
    });
    this.assertSubmissionRules(submission, activity, campaign, activeMemberCount);
    const availability = await this.activitiesService.availability(
      organizationId,
      activity,
      submission.actionDate,
      submission.id,
    );
    if (!availability.available) throw new BadRequestException(availability.reason);
    if (activity.evidenceRequired && (submission.evidences?.length ?? 0) === 0) {
      throw new BadRequestException('At least one evidence file is required');
    }
    const calculatedPoints = this.scoring.calculate({
      activity: {
        scoringType: activity.scoringType,
        points: Number(activity.points),
        rulesJson: activity.rulesJson,
      },
      quantity: Number(submission.quantity ?? 0),
      participantCount: submission.participants?.length ?? 0,
      items: (submission.items ?? []).map((item) => ({
        quantity: Number(item.quantity),
        pointsPerUnit: Number(item.itemType?.pointsPerUnit ?? 0),
      })),
    });
    await submission.update({
      status: SubmissionStatus.SUBMITTED,
      calculatedPoints: String(calculatedPoints),
      approvedPoints: '0',
    });
    return this.findOne(organizationId, id);
  }

  async validate(
    id: string,
    validatorId: string,
    input: ValidateSubmissionDto,
  ): Promise<Submission> {
    const allowed = [
      SubmissionStatus.APPROVED,
      SubmissionStatus.PARTIALLY_APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.NEEDS_CHANGES,
    ];
    if (!allowed.includes(input.status)) throw new BadRequestException('Invalid validation status');
    if (
      [SubmissionStatus.PARTIALLY_APPROVED, SubmissionStatus.REJECTED, SubmissionStatus.NEEDS_CHANGES].includes(input.status) &&
      !input.reason?.trim()
    ) {
      throw new BadRequestException('A reason is required for this decision');
    }
    return this.sequelize.transaction(async (transaction) => {
      const submission = await this.submissions.findOne({
        where: { id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!submission) throw new NotFoundException('Submission not found');
      if (![SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW].includes(submission.status)) {
        throw new BadRequestException('Submission is not awaiting validation');
      }
      const activity = await this.activities.findOne({
        where: {
          id: submission.activityId,
          organizationId: submission.organizationId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!activity) throw new BadRequestException('Activity not found');
      if (submission.createdBy === validatorId) {
        if (activity?.rulesJson.allowSelfValidation !== true) {
          throw new ForbiddenException('A validator cannot validate their own submission');
        }
      }
      if (
        [SubmissionStatus.APPROVED, SubmissionStatus.PARTIALLY_APPROVED].includes(
          input.status,
        )
      ) {
        const availability = await this.activitiesService.availability(
          submission.organizationId,
          activity,
          submission.actionDate,
          submission.id,
          transaction,
        );
        if (!availability.available) {
          throw new BadRequestException(availability.reason);
        }
        const participantRows = await this.participants.findAll({
          where: { submissionId: submission.id },
          transaction,
        });
        const participantIds = participantRows.map((row) => row.membershipId);
        const activeParticipants = participantIds.length
          ? await this.memberships.count({
              where: {
                id: { [Op.in]: participantIds },
                organizationId: submission.organizationId,
                status: EntityStatus.ACTIVE,
              },
              transaction,
            })
          : 0;
        if (activeParticipants !== participantIds.length) {
          throw new BadRequestException(
            'All participants must be active members of the team',
          );
        }
        await this.activitiesService.assertParticipantLimits(
          submission.organizationId,
          activity,
          participantIds,
          submission.actionDate,
          submission.id,
          transaction,
        );
      }
      const beforeStatus = submission.status;
      const beforePoints = Number(submission.approvedPoints);
      let approvedPoints = 0;
      if (input.status === SubmissionStatus.APPROVED) approvedPoints = Number(submission.calculatedPoints);
      if (input.status === SubmissionStatus.PARTIALLY_APPROVED) {
        if (input.approvedPoints === undefined || input.approvedPoints > Number(submission.calculatedPoints)) {
          throw new BadRequestException('Partial points must be provided and not exceed calculated points');
        }
        approvedPoints = input.approvedPoints;
      }
      await submission.update(
        { status: input.status, approvedPoints: String(approvedPoints) },
        { transaction },
      );
      await this.validationEvents.create(
        {
          submissionId: submission.id,
          validatorId,
          fromStatus: beforeStatus,
          toStatus: input.status,
          pointsBefore: String(beforePoints),
          pointsAfter: String(approvedPoints),
          reason: input.reason ?? null,
        },
        { transaction },
      );
      await this.audit.record(
        {
          organizationId: submission.organizationId,
          actorUserId: validatorId,
          action: 'SUBMISSION_VALIDATED',
          entityType: 'Submission',
          entityId: submission.id,
          metadataJson: {
            fromStatus: beforeStatus,
            toStatus: input.status,
            pointsBefore: beforePoints,
            pointsAfter: approvedPoints,
          },
        },
        transaction,
      );
      return submission;
    });
  }

  private async assertReferences(
    organizationId: string,
    campaignId: string,
    activityId: string,
  ): Promise<{ campaign: Campaign; activity: Activity }> {
    const [campaign, activity] = await Promise.all([
      this.campaigns.findOne({ where: { id: campaignId, organizationId } }),
      this.activities.findOne({ where: { id: activityId, campaignId, organizationId } }),
    ]);
    if (!campaign || !activity) {
      throw new BadRequestException('Campaign and activity must belong to the authenticated organization');
    }
    if (activity.status !== ActivityStatus.ACTIVE) throw new BadRequestException('Activity is inactive');
    return { campaign, activity };
  }

  private async replaceRelations(
    organizationId: string,
    submission: Submission,
    items: SubmissionItemDto[],
    participantIds: string[],
    transaction: Transaction,
  ): Promise<void> {
    const itemTypeIds = items.map((item) => item.activityItemTypeId);
    const validItemTypes = itemTypeIds.length
      ? await this.itemTypes.findAll({
        where: { id: { [Op.in]: itemTypeIds }, activityId: submission.activityId },
        transaction,
      })
      : [];
    if (validItemTypes.length !== new Set(itemTypeIds).size) {
      throw new BadRequestException('One or more item types do not belong to the activity');
    }
    const validMembers = participantIds.length
      ? await this.memberships.findAll({
        where: {
          id: { [Op.in]: participantIds },
          organizationId,
          status: EntityStatus.ACTIVE,
        },
        transaction,
      })
      : [];
    if (validMembers.length !== new Set(participantIds).size) {
      throw new BadRequestException('One or more participants do not belong to the organization');
    }
    await Promise.all([
      this.items.destroy({ where: { submissionId: submission.id }, transaction }),
      this.participants.destroy({ where: { submissionId: submission.id }, transaction }),
    ]);
    if (items.length) {
      const byId = new Map(validItemTypes.map((itemType) => [itemType.id, itemType]));
      await this.items.bulkCreate(
        items.map((item) => ({
          submissionId: submission.id,
          activityItemTypeId: item.activityItemTypeId,
          quantity: String(item.quantity),
          calculatedPoints: String(item.quantity * Number(byId.get(item.activityItemTypeId)!.pointsPerUnit)),
        })),
        { transaction },
      );
    }
    if (participantIds.length) {
      await this.participants.bulkCreate(
        participantIds.map((membershipId) => ({ submissionId: submission.id, membershipId })),
        { transaction },
      );
    }
  }

  private async creatorMembershipIds(
    organizationId: string,
    userId: string,
    transaction: Transaction,
  ): Promise<string[]> {
    const membership = await this.memberships.findOne({
      where: {
        organizationId,
        userId,
        status: EntityStatus.ACTIVE,
      },
      transaction,
    });
    if (!membership) {
      throw new BadRequestException('The submission author is not an active team member');
    }
    return [membership.id];
  }

  assertSubmissionRules(
    submission: Submission,
    activity: Activity,
    campaign: Campaign,
    activeMemberCount: number,
  ): void {
    if (submission.actionDate > campaign.endsAt) {
      throw new BadRequestException('Action date is outside the campaign period');
    }
    if (activity.minimumQuantity !== null && Number(submission.quantity ?? 0) < Number(activity.minimumQuantity)) {
      throw new BadRequestException(`Minimum quantity is ${activity.minimumQuantity}`);
    }
    const participantCount = submission.participants?.length ?? 0;
    if (
      activity.minimumParticipants !== null &&
      participantCount < activity.minimumParticipants
    ) {
      throw new BadRequestException(
        `Minimum participants is ${activity.minimumParticipants}`,
      );
    }
    if (activity.minimumParticipationPercent !== null) {
      if (activeMemberCount <= 0) throw new BadRequestException('Organization has no active members');
      const actual = (participantCount / activeMemberCount) * 100;
      if (actual < Number(activity.minimumParticipationPercent)) {
        throw new BadRequestException(`Minimum participation is ${activity.minimumParticipationPercent}%`);
      }
    }
    if (
      activity.rulesJson.institutionRequired === true &&
      !submission.institutionName?.trim()
    ) {
      throw new BadRequestException('Institution or community is required');
    }
    const minimumDurationMinutes = Number(
      activity.rulesJson.minimumDurationMinutes ?? 0,
    );
    const durationMinutes = Number(submission.detailsJson.durationMinutes ?? 0);
    if (minimumDurationMinutes > 0 && durationMinutes < minimumDurationMinutes) {
      throw new BadRequestException(
        `Minimum duration is ${minimumDurationMinutes} minutes`,
      );
    }
    if (
      activity.rulesJson.oneLetterPerActiveMember === true &&
      Number(submission.quantity ?? 0) !== activeMemberCount
    ) {
      throw new BadRequestException(
        'Exactly one letter per active team member is required',
      );
    }
    const minimumDistinctItems = Number(
      activity.rulesJson.minimumDistinctSchoolItems ??
        activity.rulesJson.minimumDistinctItems ??
        0,
    );
    if (
      minimumDistinctItems > 0 &&
      (submission.items?.filter((item) => Number(item.quantity) > 0).length ?? 0) <
        minimumDistinctItems
    ) {
      throw new BadRequestException(
        `At least ${minimumDistinctItems} different item types are required`,
      );
    }
  }
}
