import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { GoalStatus, GoalType } from '../../common/enums';
import { Activity, Campaign, Goal } from '../../database/models';
import {
  CreateGoalDto,
  CreateMonthlyPlanDto,
  GoalProgressDto,
  UpdateGoalDto,
} from './goals.dto';

interface ProgressRow {
  points: string;
  actions: string;
  participants: string;
  quantity: string;
}

interface GoalTargets {
  targetPoints: number;
  targetActions: number;
  targetParticipants: number;
  targetQuantity: number;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function monthPeriods(startsAt: string, endsAt: string): Array<{
  startsAt: string;
  endsAt: string;
  label: string;
}> {
  const periods: Array<{ startsAt: string; endsAt: string; label: string }> = [];
  let [year, month] = startsAt.split('-').map(Number);
  const [endYear, endMonth] = endsAt.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    periods.push({
      startsAt: monthStart < startsAt ? startsAt : monthStart,
      endsAt: monthEnd > endsAt ? endsAt : monthEnd,
      label: `${year}-${String(month).padStart(2, '0')}`,
    });
    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }
  return periods;
}

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(Goal) private readonly goals: typeof Goal,
    @InjectModel(Campaign) private readonly campaigns: typeof Campaign,
    @InjectModel(Activity) private readonly activities: typeof Activity,
    private readonly sequelize: Sequelize,
  ) {}

  findAll(campaignId?: string): Promise<Goal[]> {
    return this.goals.findAll({
      where: { organizationId: null, ...(campaignId ? { campaignId } : {}) },
      order: [['startsAt', 'DESC']],
    });
  }

  async findOne(id: string): Promise<Goal> {
    const goal = await this.goals.findOne({
      where: { id, organizationId: null },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async create(input: CreateGoalDto): Promise<Goal> {
    const campaign = await this.assertCampaign(input.campaignId);
    const startsAt = dateOnly(input.startsAt);
    const endsAt = dateOnly(input.endsAt);
    await this.validate(campaign, input.activityId, startsAt, endsAt, input);
    return this.goals.create({
      organizationId: null,
      campaignId: input.campaignId,
      activityId: input.activityId ?? null,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      startsAt,
      endsAt,
      targetPoints: String(input.targetPoints ?? 0),
      targetActions: input.targetActions ?? 0,
      targetParticipants: input.targetParticipants ?? 0,
      targetQuantity: String(input.targetQuantity ?? 0),
      unit: input.unit ?? null,
    });
  }

  async update(
    id: string,
    input: UpdateGoalDto,
  ): Promise<Goal> {
    const goal = await this.findOne(id);
    const campaignId = input.campaignId ?? goal.campaignId;
    const campaign = await this.assertCampaign(campaignId);
    const activityId =
      input.activityId === undefined ? goal.activityId : input.activityId;
    const startsAt = dateOnly(input.startsAt ?? goal.startsAt);
    const endsAt = dateOnly(input.endsAt ?? goal.endsAt);
    const targets = {
      targetPoints: input.targetPoints ?? Number(goal.targetPoints),
      targetActions: input.targetActions ?? goal.targetActions,
      targetParticipants:
        input.targetParticipants ?? goal.targetParticipants,
      targetQuantity: input.targetQuantity ?? Number(goal.targetQuantity),
    };
    await this.validate(
      campaign,
      activityId,
      startsAt,
      endsAt,
      targets,
    );
    await goal.update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      campaignId,
      activityId,
      ...(input.type !== undefined ? { type: input.type } : {}),
      startsAt,
      endsAt,
      targetPoints: String(targets.targetPoints),
      targetActions: targets.targetActions,
      targetParticipants: targets.targetParticipants,
      targetQuantity: String(targets.targetQuantity),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
    });
    return goal;
  }

  async remove(id: string): Promise<void> {
    await (await this.findOne(id)).destroy();
  }

  async createMonthlyPlan(
    input: CreateMonthlyPlanDto,
  ): Promise<Goal[]> {
    const campaign = await this.assertCampaign(input.campaignId);
    await this.validate(
      campaign,
      input.activityId,
      campaign.startsAt,
      campaign.endsAt,
      input,
    );
    return this.sequelize.transaction(async (transaction) => {
      return this.goals.bulkCreate(
        monthPeriods(campaign.startsAt, campaign.endsAt).map((period) => ({
          organizationId: null,
          campaignId: campaign.id,
          activityId: input.activityId ?? null,
          title: `${input.titlePrefix} ${period.label}`,
          description: null,
          type: GoalType.MONTHLY,
          startsAt: period.startsAt,
          endsAt: period.endsAt,
          targetPoints: String(input.targetPoints ?? 0),
          targetActions: input.targetActions ?? 0,
          targetParticipants: input.targetParticipants ?? 0,
          targetQuantity: String(input.targetQuantity ?? 0),
          unit: input.unit ?? null,
        })),
        { transaction },
      );
    });
  }

  async progress(
    organizationId: string,
    id: string,
  ): Promise<GoalProgressDto> {
    const goal = await this.findOne(id);
    const rows = await this.sequelize.query<ProgressRow>(
      `
        WITH approved AS (
          SELECT id, approved_points, quantity
          FROM submissions
          WHERE organization_id = :organizationId
            AND campaign_id = :campaignId
            AND (:activityId::uuid IS NULL OR activity_id = :activityId::uuid)
            AND action_date BETWEEN :startsAt AND :endsAt
            AND status IN ('APPROVED', 'PARTIALLY_APPROVED')
        )
        SELECT
          COALESCE((SELECT SUM(approved_points) FROM approved), 0)::text AS points,
          (SELECT COUNT(*) FROM approved)::text AS actions,
          (
            SELECT COUNT(DISTINCT sp.membership_id)
            FROM submission_participants sp
            INNER JOIN approved ON approved.id = sp.submission_id
          )::text AS participants,
          COALESCE((SELECT SUM(quantity) FROM approved), 0)::text AS quantity
      `,
      {
        replacements: {
          organizationId,
          campaignId: goal.campaignId,
          activityId: goal.activityId,
          startsAt: goal.startsAt,
          endsAt: goal.endsAt,
        },
        type: QueryTypes.SELECT,
      },
    );
    const row = rows[0] ?? {
      points: '0',
      actions: '0',
      participants: '0',
      quantity: '0',
    };
    const achieved = {
      points: Number(row.points),
      actions: Number(row.actions),
      participants: Number(row.participants),
      quantity: Number(row.quantity),
    };
    const targets = {
      points: Number(goal.targetPoints),
      actions: goal.targetActions,
      participants: goal.targetParticipants,
      quantity: Number(goal.targetQuantity),
    };
    const remaining = {
      points: Math.max(targets.points - achieved.points, 0),
      actions: Math.max(targets.actions - achieved.actions, 0),
      participants: Math.max(targets.participants - achieved.participants, 0),
      quantity: Math.max(targets.quantity - achieved.quantity, 0),
    };
    const percentages = {
      points: this.percentage(achieved.points, targets.points),
      actions: this.percentage(achieved.actions, targets.actions),
      participants: this.percentage(
        achieved.participants,
        targets.participants,
      ),
      quantity: this.percentage(achieved.quantity, targets.quantity),
    };
    const configured = (
      Object.keys(targets) as Array<keyof typeof targets>
    ).filter((key) => targets[key] > 0);
    const overallPercentage = Math.round(
      configured.reduce((sum, key) => sum + percentages[key], 0) /
        configured.length,
    );
    const allAchieved = configured.every(
      (key) => achieved[key] >= targets[key],
    );
    const currentDate = new Date().toISOString().slice(0, 10);
    const status = allAchieved
      ? GoalStatus.ACHIEVED
      : currentDate < goal.startsAt
        ? GoalStatus.NOT_STARTED
        : currentDate > goal.endsAt
          ? GoalStatus.EXPIRED
          : GoalStatus.IN_PROGRESS;
    return {
      achieved,
      targets,
      remaining,
      percentages,
      overallPercentage,
      status,
    };
  }

  private percentage(achieved: number, target: number): number {
    return target > 0 ? Math.min(Math.round((achieved / target) * 100), 100) : 0;
  }

  private async validate(
    campaign: Campaign,
    activityId: string | null | undefined,
    startsAt: string,
    endsAt: string,
    targets: Partial<GoalTargets>,
  ): Promise<void> {
    if (endsAt < startsAt) {
      throw new BadRequestException('Goal end must not precede start');
    }
    if (startsAt < campaign.startsAt || endsAt > campaign.endsAt) {
      throw new BadRequestException('Goal period must be within the campaign period');
    }
    if (
      ![
        targets.targetPoints ?? 0,
        targets.targetActions ?? 0,
        targets.targetParticipants ?? 0,
        targets.targetQuantity ?? 0,
      ].some((target) => target > 0)
    ) {
      throw new BadRequestException('At least one target must be greater than zero');
    }
    if (
      activityId &&
      !(await this.activities.findOne({
        where: {
          id: activityId,
          campaignId: campaign.id,
          organizationId: null,
        },
      }))
    ) {
      throw new BadRequestException(
        'Activity must belong to the selected campaign and organization',
      );
    }
  }

  private async assertCampaign(
    campaignId: string,
  ): Promise<Campaign> {
    const campaign = await this.campaigns.findOne({
      where: { id: campaignId, organizationId: null },
    });
    if (!campaign) {
      throw new BadRequestException(
        'Campaign does not belong to the authenticated organization',
      );
    }
    return campaign;
  }
}
