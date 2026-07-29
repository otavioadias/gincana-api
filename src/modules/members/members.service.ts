import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize-typescript';
import { EntityStatus, PlatformRole } from '../../common/enums';
import { Membership, User } from '../../database/models';
import { CreateMemberDto, ParticipantDto, UpdateMemberDto } from './members.dto';

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Membership) private readonly memberships: typeof Membership,
    @InjectModel(User) private readonly users: typeof User,
    private readonly sequelize: Sequelize,
    private readonly config: ConfigService,
  ) {}

  findAll(organizationId: string): Promise<Membership[]> {
    return this.memberships.findAll({
      where: { organizationId },
      include: [{ model: User, attributes: { exclude: ['passwordHash'] } }],
      order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
    });
  }

  async findParticipants(organizationId: string): Promise<ParticipantDto[]> {
    const memberships = await this.memberships.findAll({
      attributes: ['id', 'userId', 'role', 'status'],
      where: { organizationId, status: EntityStatus.ACTIVE },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'status'],
          where: { status: EntityStatus.ACTIVE },
          required: true,
        },
      ],
      order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
    });
    return memberships.map((membership) => ({
      id: membership.id,
      name: membership.user!.name,
      status: membership.status,
    }));
  }

  async findOne(organizationId: string, id: string): Promise<Membership> {
    const member = await this.memberships.findOne({
      where: { id, organizationId },
      include: [{ model: User, attributes: { exclude: ['passwordHash'] } }],
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async create(organizationId: string, input: CreateMemberDto): Promise<Membership> {
    return this.sequelize.transaction(async (transaction) => {
      const existingUser = await this.users.findOne({
        where: { email: input.email.toLowerCase() },
        transaction,
      });
      if (existingUser) throw new ConflictException('Email is already registered');
      const user = await this.users.create(
        {
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash: await bcrypt.hash(
            input.temporaryPassword,
            this.config.get<number>('BCRYPT_ROUNDS', 12),
          ),
          platformRole: PlatformRole.USER,
          mustChangePassword: true,
          status: EntityStatus.ACTIVE,
        },
        { transaction },
      );
      return this.memberships.create(
        {
          organizationId,
          userId: user.id,
          role: input.role,
          status: EntityStatus.ACTIVE,
          joinedAt: new Date(),
        },
        { transaction },
      );
    });
  }

  async update(organizationId: string, id: string, input: UpdateMemberDto): Promise<Membership> {
    const membership = await this.findOne(organizationId, id);
    await this.sequelize.transaction(async (transaction) => {
      if (input.role || input.status) {
        await membership.update(
          {
            ...(input.role ? { role: input.role } : {}),
            ...(input.status ? { status: input.status } : {}),
          },
          { transaction },
        );
      }
      if (input.name) await this.users.update({ name: input.name }, { where: { id: membership.userId }, transaction });
      if (input.temporaryPassword) {
        await this.users.update(
          {
            passwordHash: await bcrypt.hash(
              input.temporaryPassword,
              this.config.get<number>('BCRYPT_ROUNDS', 12),
            ),
            mustChangePassword: true,
          },
          { where: { id: membership.userId }, transaction },
        );
      }
    });
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const membership = await this.findOne(organizationId, id);
    await membership.update({ status: EntityStatus.INACTIVE });
  }
}
