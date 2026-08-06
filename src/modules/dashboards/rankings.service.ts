import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { EntityStatus, PlatformRole } from '../../common/enums';
import { Organization } from '../../database/models';
import { StorageService } from '../evidences/storage.service';
import {
  RankingEntryDto,
  TeamMemberRankingDto,
} from './dashboards.dto';

interface RankingRow {
  organizationId: string;
  name: string;
  slug: string;
  logoKey: string | null;
  points: string;
  lastUpdatedAt: Date | string | null;
}

interface MemberRankingRow {
  membershipId: string;
  userId: string;
  name: string;
  points: string;
  approvedActions: string;
  lastUpdatedAt: Date | string | null;
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly storage: StorageService,
    @InjectModel(Organization)
    private readonly organizations: typeof Organization,
  ) {}

  async findAll(campaignId?: string): Promise<RankingEntryDto[]> {
    const rows = await this.sequelize.query<RankingRow>(
      `
        SELECT
          organization.id AS "organizationId",
          organization.name,
          organization.slug,
          organization.logo_key AS "logoKey",
          COALESCE(
            SUM(submission.approved_points) FILTER (
              WHERE submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ),
            0
          )::text AS points,
          GREATEST(
            organization.updated_at,
            MAX(submission.updated_at)
          ) AS "lastUpdatedAt"
        FROM organizations organization
        LEFT JOIN submissions submission
          ON submission.organization_id = organization.id
          AND (
            :campaignId::uuid IS NULL
            OR submission.campaign_id = :campaignId::uuid
          )
        WHERE organization.status = 'ACTIVE'
        GROUP BY
          organization.id,
          organization.name,
          organization.slug,
          organization.logo_key,
          organization.updated_at
        ORDER BY
          COALESCE(
            SUM(submission.approved_points) FILTER (
              WHERE submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ),
            0
          ) DESC,
          GREATEST(organization.updated_at, MAX(submission.updated_at)) DESC,
          organization.name ASC
      `,
      {
        replacements: { campaignId: campaignId ?? null },
        type: QueryTypes.SELECT,
      },
    );
    return Promise.all(
      rows.map(async (row, index) => ({
        position: index + 1,
        organizationId: row.organizationId,
        name: row.name,
        slug: row.slug,
        photoUrl: row.logoKey
          ? await this.storage.signedReadUrl(row.logoKey)
          : null,
        points: Number(row.points),
        lastUpdatedAt: row.lastUpdatedAt
          ? new Date(row.lastUpdatedAt).toISOString()
          : null,
      })),
    );
  }

  async findMembers(
    user: AuthenticatedPrincipal,
    requestedOrganizationId?: string,
    campaignId?: string,
  ): Promise<TeamMemberRankingDto> {
    const organizationId = this.allowedOrganizationId(
      user,
      requestedOrganizationId,
    );
    const organization = await this.organizations.findOne({
      where: { id: organizationId, status: EntityStatus.ACTIVE },
    });
    if (!organization) throw new NotFoundException('Team not found');
    const rows = await this.sequelize.query<MemberRankingRow>(
      `
        SELECT
          membership.id AS "membershipId",
          member.id AS "userId",
          member.name,
          COALESCE(
            SUM(submission.approved_points) FILTER (
              WHERE submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ),
            0
          )::text AS points,
          COUNT(submission.id) FILTER (
            WHERE submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')
          )::text AS "approvedActions",
          GREATEST(
            membership.updated_at,
            member.updated_at,
            MAX(submission.updated_at)
          ) AS "lastUpdatedAt"
        FROM memberships membership
        INNER JOIN users member
          ON member.id = membership.user_id
          AND member.status = 'ACTIVE'
        LEFT JOIN submissions submission
          ON submission.organization_id = membership.organization_id
          AND submission.created_by = member.id
          AND (
            :campaignId::uuid IS NULL
            OR submission.campaign_id = :campaignId::uuid
          )
        WHERE membership.organization_id = :organizationId
          AND membership.status = 'ACTIVE'
        GROUP BY
          membership.id,
          membership.updated_at,
          member.id,
          member.name,
          member.updated_at
        ORDER BY
          COALESCE(
            SUM(submission.approved_points) FILTER (
              WHERE submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ),
            0
          ) DESC,
          COUNT(submission.id) FILTER (
            WHERE submission.status IN ('APPROVED', 'PARTIALLY_APPROVED')
          ) DESC,
          GREATEST(
            membership.updated_at,
            member.updated_at,
            MAX(submission.updated_at)
          ) DESC,
          member.name ASC
      `,
      {
        replacements: {
          organizationId,
          campaignId: campaignId ?? null,
        },
        type: QueryTypes.SELECT,
      },
    );
    return {
      team: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      ranking: rows.map((row, index) => ({
        position: index + 1,
        membershipId: row.membershipId,
        userId: row.userId,
        name: row.name,
        points: Number(row.points),
        approvedActions: Number(row.approvedActions),
        lastUpdatedAt: row.lastUpdatedAt
          ? new Date(row.lastUpdatedAt).toISOString()
          : null,
      })),
    };
  }

  private allowedOrganizationId(
    user: AuthenticatedPrincipal,
    requestedOrganizationId?: string,
  ): string {
    if (user.platformRole === PlatformRole.ADMIN) {
      if (!requestedOrganizationId) {
        throw new BadRequestException(
          'organizationId is required for admin users',
        );
      }
      return requestedOrganizationId;
    }
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an active team');
    }
    if (
      requestedOrganizationId &&
      requestedOrganizationId !== user.organizationId
    ) {
      throw new ForbiddenException(
        'Users can only view their own team ranking',
      );
    }
    return user.organizationId;
  }
}
