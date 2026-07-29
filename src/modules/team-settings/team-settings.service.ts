import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Organization } from '../../database/models';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../evidences/storage.service';
import { TeamProfileDto, UpdateTeamThemeDto } from './team-settings.dto';

type UploadFile = Express.Multer.File;

const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const LOGO_FORMATS: Record<
  string,
  { extensions: string[]; signature: (buffer: Buffer) => boolean }
> = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    signature: (buffer) =>
      buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  'image/png': {
    extensions: ['.png'],
    signature: (buffer) =>
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extensions: ['.webp'],
    signature: (buffer) =>
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
};

@Injectable()
export class TeamSettingsService {
  constructor(
    @InjectModel(Organization)
    private readonly organizations: typeof Organization,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly sequelize: Sequelize,
  ) {}

  async find(organizationId: string): Promise<TeamProfileDto> {
    return this.profile(await this.findOrganization(organizationId));
  }

  async updateTheme(
    organizationId: string,
    actorUserId: string,
    input: UpdateTeamThemeDto,
  ): Promise<TeamProfileDto> {
    const organization = await this.findOrganization(organizationId);
    await this.sequelize.transaction(async (transaction) => {
      const previous = {
        primaryColor: organization.primaryColor,
        secondaryColor: organization.secondaryColor,
      };
      await organization.update(input, { transaction });
      await this.audit.record(
        {
          organizationId,
          actorUserId,
          action: 'TEAM_THEME_UPDATED',
          entityType: 'Organization',
          entityId: organizationId,
          metadataJson: { previous, current: input },
        },
        transaction,
      );
    });
    return this.profile(organization);
  }

  async uploadLogo(
    organizationId: string,
    actorUserId: string,
    file: UploadFile,
  ): Promise<TeamProfileDto> {
    if (!file) throw new BadRequestException('Logo file is required');
    if (file.size > MAX_LOGO_SIZE) {
      throw new BadRequestException('Logo must not exceed 5 MB');
    }
    const format = LOGO_FORMATS[file.mimetype];
    const extension = extname(file.originalname).toLowerCase();
    if (
      !format ||
      !format.extensions.includes(extension) ||
      !format.signature(file.buffer)
    ) {
      throw new BadRequestException(
        'Logo MIME, extension, or binary signature is invalid',
      );
    }
    const organization = await this.findOrganization(organizationId);
    const previousKey = organization.logoKey;
    const logoKey = `teams/${organizationId}/logo/${randomUUID()}${extension}`;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    await this.storage.put(logoKey, file.buffer, file.mimetype, checksum);
    try {
      await this.sequelize.transaction(async (transaction) => {
        await organization.update({ logoKey }, { transaction });
        await this.audit.record(
          {
            organizationId,
            actorUserId,
            action: 'TEAM_LOGO_UPLOADED',
            entityType: 'Organization',
            entityId: organizationId,
            metadataJson: { mimeType: file.mimetype, sizeBytes: file.size },
          },
          transaction,
        );
      });
    } catch (error) {
      await this.storage.delete(logoKey);
      throw error;
    }
    if (previousKey) await this.storage.delete(previousKey);
    return this.profile(organization);
  }

  async removeLogo(organizationId: string, actorUserId: string): Promise<void> {
    const organization = await this.findOrganization(organizationId);
    const previousKey = organization.logoKey;
    if (!previousKey) return;
    await this.sequelize.transaction(async (transaction) => {
      await organization.update({ logoKey: null }, { transaction });
      await this.audit.record(
        {
          organizationId,
          actorUserId,
          action: 'TEAM_LOGO_REMOVED',
          entityType: 'Organization',
          entityId: organizationId,
        },
        transaction,
      );
    });
    await this.storage.delete(previousKey);
  }

  private async profile(organization: Organization): Promise<TeamProfileDto> {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      primaryColor: organization.primaryColor,
      secondaryColor: organization.secondaryColor,
      hasLogo: Boolean(organization.logoKey),
      logoUrl: organization.logoKey
        ? await this.storage.signedReadUrl(organization.logoKey)
        : null,
    };
  }

  private async findOrganization(id: string): Promise<Organization> {
    const organization = await this.organizations.findOne({ where: { id } });
    if (!organization) throw new NotFoundException('Team not found');
    return organization;
  }
}
