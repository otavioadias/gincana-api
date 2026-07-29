import { Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { Goal, Submission } from '../../database/models';
import { InjectModel } from '@nestjs/sequelize';

interface SummaryRow {
  approvedPoints: string;
  pendingPoints: string;
  totalPoints: string;
  approvedActions: string;
  pendingActions: string;
  totalActions: string;
  myApprovedPoints: string;
  myPendingPoints: string;
  myTotalPoints: string;
  myApprovedActions: string;
  myPendingActions: string;
  myTotalActions: string;
  activeParticipants: string;
}

interface ActivityRow {
  activityId: string;
  activityName: string;
  approvedPoints: string;
  pendingPoints: string;
  totalPoints: string;
  approvedActions: string;
  pendingActions: string;
  totalActions: string;
}

interface MonthRow {
  month: string;
  approvedActions: string;
  pendingActions: string;
  totalActions: string;
  minimumActions: string;
  closed: boolean;
}

@Injectable()
export class DashboardsService {
  constructor(
    private readonly sequelize: Sequelize,
    @InjectModel(Submission) private readonly submissions: typeof Submission,
    @InjectModel(Goal) private readonly goals: typeof Goal,
  ) {}

  async summary(
    organizationId: string,
    userId: string,
    campaignId?: string,
  ): Promise<Record<string, unknown>> {
    const rows = await this.sequelize.query<SummaryRow>(
      `
        WITH tracked AS (
          SELECT *
          FROM submissions
          WHERE organization_id = :organizationId
            AND status IN (
              'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES',
              'APPROVED', 'PARTIALLY_APPROVED'
            )
            AND (:campaignId::uuid IS NULL OR campaign_id = :campaignId::uuid)
        )
        SELECT
          COALESCE(SUM(approved_points) FILTER (
            WHERE status IN ('APPROVED', 'PARTIALLY_APPROVED')
          ), 0)::text AS "approvedPoints",
          COALESCE(SUM(calculated_points) FILTER (
            WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
          ), 0)::text AS "pendingPoints",
          (
            COALESCE(SUM(approved_points) FILTER (
              WHERE status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ), 0) +
            COALESCE(SUM(calculated_points) FILTER (
              WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
            ), 0)
          )::text AS "totalPoints",
          COUNT(*) FILTER (
            WHERE status IN ('APPROVED', 'PARTIALLY_APPROVED')
          )::text AS "approvedActions",
          COUNT(*) FILTER (
            WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
          )::text AS "pendingActions",
          COUNT(*)::text AS "totalActions",
          COALESCE(SUM(approved_points) FILTER (
            WHERE created_by = :userId
              AND status IN ('APPROVED', 'PARTIALLY_APPROVED')
          ), 0)::text AS "myApprovedPoints",
          COALESCE(SUM(calculated_points) FILTER (
            WHERE created_by = :userId
              AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
          ), 0)::text AS "myPendingPoints",
          (
            COALESCE(SUM(approved_points) FILTER (
              WHERE created_by = :userId
                AND status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ), 0) +
            COALESCE(SUM(calculated_points) FILTER (
              WHERE created_by = :userId
                AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
            ), 0)
          )::text AS "myTotalPoints",
          COUNT(*) FILTER (
            WHERE created_by = :userId
              AND status IN ('APPROVED', 'PARTIALLY_APPROVED')
          )::text AS "myApprovedActions",
          COUNT(*) FILTER (
            WHERE created_by = :userId
              AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
          )::text AS "myPendingActions",
          COUNT(*) FILTER (WHERE created_by = :userId)::text AS "myTotalActions",
          (
            SELECT COUNT(DISTINCT sp.membership_id)
            FROM submission_participants sp
            INNER JOIN tracked participant_submission
              ON participant_submission.id = sp.submission_id
          )::text AS "activeParticipants"
        FROM tracked
      `,
      {
        replacements: { organizationId, userId, campaignId: campaignId ?? null },
        type: QueryTypes.SELECT,
      },
    );
    const regularity = await this.monthlyRegularity(organizationId, campaignId);
    const goals = await this.goals.findAll({
      where: { organizationId, ...(campaignId ? { campaignId } : {}) },
      order: [['startsAt', 'DESC']],
    });
    const row = rows[0] ?? {
      approvedPoints: '0',
      pendingPoints: '0',
      totalPoints: '0',
      approvedActions: '0',
      pendingActions: '0',
      totalActions: '0',
      myApprovedPoints: '0',
      myPendingPoints: '0',
      myTotalPoints: '0',
      myApprovedActions: '0',
      myPendingActions: '0',
      myTotalActions: '0',
      activeParticipants: '0',
    };
    return {
      approvedPoints: Number(row.approvedPoints),
      pendingPoints: Number(row.pendingPoints),
      totalPoints: Number(row.totalPoints),
      approvedActions: Number(row.approvedActions),
      pendingActions: Number(row.pendingActions),
      totalActions: Number(row.totalActions),
      myApprovedPoints: Number(row.myApprovedPoints),
      myPendingPoints: Number(row.myPendingPoints),
      myTotalPoints: Number(row.myTotalPoints),
      myApprovedActions: Number(row.myApprovedActions),
      myPendingActions: Number(row.myPendingActions),
      myTotalActions: Number(row.myTotalActions),
      activeParticipants: Number(row.activeParticipants),
      regularity,
      disqualified: regularity.some(
        (month) => month.closed === true && month.regular === false,
      ),
      goals,
    };
  }

  async byActivity(organizationId: string, campaignId?: string): Promise<Record<string, unknown>[]> {
    const rows = await this.sequelize.query<ActivityRow>(
      `
        SELECT
          a.id AS "activityId",
          a.name AS "activityName",
          COALESCE(SUM(s.approved_points) FILTER (
            WHERE s.status IN ('APPROVED', 'PARTIALLY_APPROVED')
          ), 0)::text AS "approvedPoints",
          COALESCE(SUM(s.calculated_points) FILTER (
            WHERE s.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
          ), 0)::text AS "pendingPoints",
          (
            COALESCE(SUM(s.approved_points) FILTER (
              WHERE s.status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ), 0) +
            COALESCE(SUM(s.calculated_points) FILTER (
              WHERE s.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
            ), 0)
          )::text AS "totalPoints",
          COUNT(s.id) FILTER (
            WHERE s.status IN ('APPROVED', 'PARTIALLY_APPROVED')
          )::text AS "approvedActions",
          COUNT(s.id) FILTER (
            WHERE s.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
          )::text AS "pendingActions",
          COUNT(s.id)::text AS "totalActions"
        FROM activities a
        LEFT JOIN submissions s ON s.activity_id = a.id
          AND s.organization_id = :organizationId
          AND s.status IN (
            'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES',
            'APPROVED', 'PARTIALLY_APPROVED'
          )
        WHERE a.organization_id = :organizationId
          AND (:campaignId::uuid IS NULL OR a.campaign_id = :campaignId::uuid)
        GROUP BY a.id, a.name
        ORDER BY a.name
      `,
      {
        replacements: { organizationId, campaignId: campaignId ?? null },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((row) => ({
      activityId: row.activityId,
      activityName: row.activityName,
      approvedPoints: Number(row.approvedPoints),
      pendingPoints: Number(row.pendingPoints),
      totalPoints: Number(row.totalPoints),
      approvedActions: Number(row.approvedActions),
      pendingActions: Number(row.pendingActions),
      totalActions: Number(row.totalActions),
    }));
  }

  private async monthlyRegularity(
    organizationId: string,
    campaignId?: string,
  ): Promise<Record<string, unknown>[]> {
    const rows = await this.sequelize.query<MonthRow>(
      `
        WITH selected_campaign AS (
          SELECT id, starts_at, ends_at, minimum_actions_per_month
          FROM campaigns
          WHERE organization_id = :organizationId
            AND (:campaignId::uuid IS NULL OR id = :campaignId::uuid)
          ORDER BY starts_at DESC
          LIMIT 1
        ),
        months AS (
          SELECT
            campaign.id AS campaign_id,
            month_start::date,
            LEAST(
              campaign.ends_at,
              (month_start + interval '1 month - 1 day')::date
            ) AS effective_end,
            campaign.minimum_actions_per_month
          FROM selected_campaign campaign
          CROSS JOIN LATERAL generate_series(
            date_trunc('month', campaign.starts_at),
            date_trunc('month', campaign.ends_at),
            interval '1 month'
          ) AS month_start
        )
        SELECT
          to_char(months.month_start, 'YYYY-MM') AS month,
          COUNT(submission.id) FILTER (
            WHERE submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')
          )::text AS "approvedActions",
          COUNT(submission.id) FILTER (
            WHERE submission.status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')
          )::text AS "pendingActions",
          COUNT(submission.id) FILTER (
            WHERE submission.status IN (
              'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES',
              'APPROVED', 'PARTIALLY_APPROVED'
            )
          )::text AS "totalActions",
          months.minimum_actions_per_month::text AS "minimumActions",
          (months.effective_end < CURRENT_DATE) AS closed
        FROM months
        LEFT JOIN submissions submission
          ON submission.campaign_id = months.campaign_id
          AND submission.organization_id = :organizationId
          AND submission.action_date >= months.month_start
          AND submission.action_date < months.month_start + interval '1 month'
        GROUP BY
          months.month_start,
          months.effective_end,
          months.minimum_actions_per_month
        ORDER BY months.month_start
      `,
      {
        replacements: { organizationId, campaignId: campaignId ?? null },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((row) => ({
      month: row.month,
      approvedActions: Number(row.approvedActions),
      pendingActions: Number(row.pendingActions),
      totalActions: Number(row.totalActions),
      minimumActions: Number(row.minimumActions),
      closed: row.closed,
      regular: Number(row.approvedActions) >= Number(row.minimumActions),
    }));
  }
}
