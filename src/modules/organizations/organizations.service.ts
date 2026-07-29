import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize-typescript';
import { EntityStatus, MembershipRole, PlatformRole } from '../../common/enums';
import { Membership, Organization, User } from '../../database/models';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization) private readonly organizations: typeof Organization,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Membership) private readonly memberships: typeof Membership,
    private readonly sequelize: Sequelize,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  findAll(): Promise<Organization[]> {
    return this.organizations.findAll({ order: [['name', 'ASC']] });
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.organizations.findByPk(id);
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async create(input: CreateOrganizationDto, actorUserId: string): Promise<Organization> {
    const duplicate = await this.organizations.findOne({ where: { slug: input.slug } });
    if (duplicate) throw new ConflictException('Slug is already in use');
    return this.sequelize.transaction(async (transaction) => {
      const organization = await this.organizations.create(
        {
          name: input.name,
          slug: input.slug,
          logoKey: null,
          primaryColor: input.primaryColor ?? '#164E63',
          secondaryColor: input.secondaryColor ?? '#F59E0B',
          status: EntityStatus.ACTIVE,
        },
        { transaction },
      );
      const passwordHash = await bcrypt.hash(
        input.managerTemporaryPassword,
        this.config.get<number>('BCRYPT_ROUNDS', 12),
      );
      const [manager, created] = await this.users.findOrCreate({
        where: { email: input.managerEmail.toLowerCase() },
        defaults: {
          name: input.managerName,
          email: input.managerEmail.toLowerCase(),
          passwordHash,
          platformRole: PlatformRole.LEADER,
          mustChangePassword: true,
          status: EntityStatus.ACTIVE,
        },
        transaction,
      });
      if (!created) throw new ConflictException('Manager email is already registered');
      await this.memberships.create(
        {
          organizationId: organization.id,
          userId: manager.id,
          role: MembershipRole.MANAGER,
          status: EntityStatus.ACTIVE,
          joinedAt: new Date(),
        },
        { transaction },
      );
      await this.audit.record(
        {
          organizationId: organization.id,
          actorUserId,
          action: 'ORGANIZATION_CREATED',
          entityType: 'Organization',
          entityId: organization.id,
        },
        transaction,
      );
      return organization;
    });
  }

  async update(id: string, input: UpdateOrganizationDto, actorUserId: string): Promise<Organization> {
    const organization = await this.findOne(id);
    const allowed = {
      name: input.name,
      slug: input.slug,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      status: input.status,
    };
    await organization.update(
      Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined)),
    );
    await this.audit.record({
      organizationId: organization.id,
      actorUserId,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'Organization',
      entityId: organization.id,
    });
    return organization;
  }

  async remove(id: string, actorUserId: string): Promise<void> {
    const organization = await this.findOne(id);
    await organization.update({ status: EntityStatus.INACTIVE });
    await this.audit.record({
      organizationId: id,
      actorUserId,
      action: 'ORGANIZATION_DEACTIVATED',
      entityType: 'Organization',
      entityId: id,
    });
  }
}
