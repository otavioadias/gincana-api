import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { EntityStatus, MembershipRole, PlatformRole } from '../../common/enums';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { Membership, Organization, RefreshToken, User } from '../../database/models';
import { CreateOwnTeamDto, LoginDto, RegisterLeaderDto } from './auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Membership) private readonly memberships: typeof Membership,
    @InjectModel(Organization) private readonly organizations: typeof Organization,
    @InjectModel(RefreshToken) private readonly refreshTokens: typeof RefreshToken,
    private readonly sequelize: Sequelize,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(input: LoginDto): Promise<TokenPair> {
    const user = await this.users.findOne({ where: { email: input.email.toLowerCase() } });
    if (!user || user.status !== EntityStatus.ACTIVE || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const membership = await this.resolveMembership(user);
    return this.issuePair(user, membership, input.deviceInfo);
  }

  async registerLeader(input: RegisterLeaderDto): Promise<TokenPair> {
    const email = input.email.toLowerCase();
    const existingUser = await this.users.findOne({ where: { email } });
    if (existingUser) throw new ConflictException('Email is already registered');

    return this.sequelize.transaction(async (transaction) => {
      const user = await this.users.create(
        {
          name: input.name.trim(),
          email,
          passwordHash: await bcrypt.hash(
            input.password,
            this.config.get<number>('BCRYPT_ROUNDS', 12),
          ),
          platformRole: PlatformRole.LEADER,
          mustChangePassword: false,
          status: EntityStatus.ACTIVE,
        },
        { transaction },
      );
      return this.issuePair(user, null, input.deviceInfo, transaction);
    });
  }

  async createTeam(
    userId: string,
    input: CreateOwnTeamDto,
  ): Promise<TokenPair> {
    const user = await this.users.findByPk(userId);
    if (
      !user ||
      user.status !== EntityStatus.ACTIVE ||
      user.platformRole !== PlatformRole.LEADER
    ) {
      throw new UnauthorizedException('Only a leader can create a team');
    }
    const existingMembership = await this.memberships.findOne({
      where: { userId, status: EntityStatus.ACTIVE },
    });
    if (existingMembership) {
      throw new ConflictException('Leader already belongs to a team');
    }

    return this.sequelize.transaction(async (transaction) => {
      const slug = await this.availableSlug(input.teamName, transaction);
      const organization = await this.organizations.create(
        {
          name: input.teamName.trim(),
          slug,
          logoKey: null,
          primaryColor: '#164E63',
          secondaryColor: '#F59E0B',
          status: EntityStatus.ACTIVE,
        },
        { transaction },
      );
      const membership = await this.memberships.create(
        {
          organizationId: organization.id,
          userId: user.id,
          role: MembershipRole.MANAGER,
          status: EntityStatus.ACTIVE,
          joinedAt: new Date(),
        },
        { transaction },
      );
      return this.issuePair(user, membership, input.deviceInfo, transaction);
    });
  }

  async rotate(rawToken: string, deviceInfo?: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawToken);
    const current = await this.refreshTokens.findOne({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [User],
    });
    if (!current?.user || current.user.status !== EntityStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const membership = await this.resolveMembership(current.user);
    return this.refreshTokens.sequelize!.transaction(async (transaction) => {
      const locked = await this.refreshTokens.findByPk(current.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!locked || locked.revokedAt) {
        throw new UnauthorizedException('Refresh token reuse detected');
      }
      locked.revokedAt = new Date();
      await locked.save({ transaction });
      const pair = await this.issuePair(current.user!, membership, deviceInfo ?? current.deviceInfo ?? undefined, transaction);
      const replacement = await this.refreshTokens.findOne({
        where: { tokenHash: this.hashToken(pair.refreshToken) },
        transaction,
      });
      locked.replacedByTokenId = replacement?.id ?? null;
      await locked.save({ transaction });
      return pair;
    });
  }

  async logout(rawToken: string): Promise<void> {
    const [updated] = await this.refreshTokens.update(
      { revokedAt: new Date() },
      { where: { tokenHash: this.hashToken(rawToken), revokedAt: null } },
    );
    if (!updated) throw new ConflictException('Token already invalidated');
  }

  async principalFromPayload(payload: AuthenticatedPrincipal): Promise<AuthenticatedPrincipal> {
    const user = await this.users.findByPk(payload.userId);
    if (!user || user.status !== EntityStatus.ACTIVE) throw new UnauthorizedException();
    if (payload.organizationId) {
      if (!payload.membershipId) throw new UnauthorizedException('Membership is missing');
      const membership = await this.memberships.findOne({
        where: {
          id: payload.membershipId,
          userId: payload.userId,
          organizationId: payload.organizationId,
          status: EntityStatus.ACTIVE,
        },
      });
      if (!membership) throw new UnauthorizedException('Membership is no longer active');
    }
    return payload;
  }

  private async resolveMembership(user: User): Promise<Membership | null> {
    if (
      user.platformRole === PlatformRole.SUPER_ADMIN ||
      user.platformRole === PlatformRole.VALIDATOR
    ) {
      return null;
    }
    const membership = await this.memberships.findOne({
      where: { userId: user.id, status: EntityStatus.ACTIVE },
      include: [{ model: Organization, where: { status: EntityStatus.ACTIVE } }],
      order: [['joinedAt', 'ASC']],
    });
    if (!membership && user.platformRole === PlatformRole.LEADER) return null;
    if (!membership) throw new UnauthorizedException('No active organization membership');
    return membership;
  }

  private async availableSlug(name: string, transaction: Transaction): Promise<string> {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'equipe';
    const exact = await this.organizations.findOne({ where: { slug: normalized }, transaction });
    if (!exact) return normalized;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(3).toString('hex');
      const candidate = `${normalized.slice(0, 93)}-${suffix}`;
      const duplicate = await this.organizations.findOne({ where: { slug: candidate }, transaction });
      if (!duplicate) return candidate;
    }
    throw new ConflictException('Could not generate a unique team identifier');
  }

  private async issuePair(
    user: User,
    membership: Membership | null,
    deviceInfo?: string,
    transaction?: Transaction,
  ): Promise<TokenPair> {
    const payload: AuthenticatedPrincipal = {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      organizationId: membership?.organizationId ?? null,
      membershipId: membership?.id ?? null,
      membershipRole: membership?.role ?? null,
    };
    const ttl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    await this.refreshTokens.create(
      {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 86_400_000),
        revokedAt: null,
        deviceInfo: deviceInfo ?? null,
        replacedByTokenId: null,
      },
      { transaction },
    );
    return { accessToken, refreshToken, expiresIn: ttl };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
