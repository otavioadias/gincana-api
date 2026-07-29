import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript';
import {
  ActivityStatus,
  CampaignStatus,
  EntityStatus,
  GoalType,
  MembershipRole,
  PlatformRole,
  ScoringType,
  SubmissionStatus,
} from '../common/enums';

type JsonRecord = Record<string, unknown>;

abstract class UuidModel<T extends object, C extends object = Partial<T>> extends Model<T, C> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}

abstract class UuidCreatedModel<
  T extends object,
  C extends object = Partial<T>,
> extends Model<T, C> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;
}

@Table({ tableName: 'organizations', underscored: true })
export class Organization extends UuidModel<Organization> {
  @AllowNull(false) @Column(DataType.STRING(160)) declare name: string;
  @Unique @AllowNull(false) @Column(DataType.STRING(100)) declare slug: string;
  @Column(DataType.STRING(500)) declare logoKey: string | null;
  @AllowNull(false) @Default('#164E63') @Column(DataType.STRING(7)) declare primaryColor: string;
  @AllowNull(false) @Default('#F59E0B') @Column(DataType.STRING(7)) declare secondaryColor: string;
  @AllowNull(false) @Default(EntityStatus.ACTIVE) @Column(DataType.STRING(20))
  declare status: EntityStatus;
}

@Table({ tableName: 'users', underscored: true })
export class User extends UuidModel<User> {
  @AllowNull(false) @Column(DataType.STRING(160)) declare name: string;
  @Unique @AllowNull(false) @Column(DataType.STRING(320)) declare email: string;
  @AllowNull(false) @Column(DataType.STRING(255)) declare passwordHash: string;
  @AllowNull(false) @Default(PlatformRole.USER) @Column(DataType.STRING(30))
  declare platformRole: PlatformRole;
  @AllowNull(false) @Default(true) @Column(DataType.BOOLEAN) declare mustChangePassword: boolean;
  @AllowNull(false) @Default(EntityStatus.ACTIVE) @Column(DataType.STRING(20))
  declare status: EntityStatus;
}

@Table({
  tableName: 'memberships',
  underscored: true,
  indexes: [{ unique: true, fields: ['organization_id', 'user_id'] }],
})
export class Membership extends UuidModel<Membership> {
  @ForeignKey(() => Organization) @AllowNull(false) @Column(DataType.UUID)
  declare organizationId: string;
  @BelongsTo(() => Organization) declare organization?: Organization;
  @ForeignKey(() => User) @AllowNull(false) @Column(DataType.UUID) declare userId: string;
  @BelongsTo(() => User) declare user?: User;
  @AllowNull(false) @Column(DataType.STRING(30)) declare role: MembershipRole;
  @AllowNull(false) @Default(EntityStatus.ACTIVE) @Column(DataType.STRING(20))
  declare status: EntityStatus;
  @AllowNull(false) @Default(DataType.NOW) @Column(DataType.DATE) declare joinedAt: Date;
}

@Table({ tableName: 'refresh_tokens', underscored: true })
export class RefreshToken extends UuidModel<RefreshToken> {
  @ForeignKey(() => User) @AllowNull(false) @Column(DataType.UUID) declare userId: string;
  @BelongsTo(() => User) declare user?: User;
  @Unique @AllowNull(false) @Column(DataType.STRING(64)) declare tokenHash: string;
  @AllowNull(false) @Column(DataType.DATE) declare expiresAt: Date;
  @Column(DataType.DATE) declare revokedAt: Date | null;
  @Column(DataType.STRING(500)) declare deviceInfo: string | null;
  @Column(DataType.UUID) declare replacedByTokenId: string | null;
}

@Table({
  tableName: 'campaigns',
  underscored: true,
  indexes: [{ fields: ['organization_id', 'status'] }],
})
export class Campaign extends UuidModel<Campaign> {
  @ForeignKey(() => Organization) @Column(DataType.UUID)
  declare organizationId: string | null;
  @BelongsTo(() => Organization) declare organization?: Organization;
  @AllowNull(false) @Column(DataType.STRING(180)) declare name: string;
  @Column(DataType.TEXT) declare description: string | null;
  @AllowNull(false) @Column(DataType.DATEONLY) declare startsAt: string;
  @AllowNull(false) @Column(DataType.DATEONLY) declare endsAt: string;
  @AllowNull(false) @Default(CampaignStatus.DRAFT) @Column(DataType.STRING(20))
  declare status: CampaignStatus;
  @AllowNull(false) @Default(1) @Column(DataType.INTEGER)
  declare minimumActionsPerMonth: number;
}

@Table({
  tableName: 'activities',
  underscored: true,
  indexes: [{ fields: ['organization_id', 'campaign_id', 'status'] }],
})
export class Activity extends UuidModel<Activity> {
  @ForeignKey(() => Organization) @Column(DataType.UUID)
  declare organizationId: string | null;
  @ForeignKey(() => Campaign) @AllowNull(false) @Column(DataType.UUID) declare campaignId: string;
  @BelongsTo(() => Campaign) declare campaign?: Campaign;
  @AllowNull(false) @Column(DataType.STRING(180)) declare name: string;
  @Column(DataType.TEXT) declare description: string | null;
  @AllowNull(false) @Column(DataType.STRING(30)) declare scoringType: ScoringType;
  @AllowNull(false) @Default(0) @Column(DataType.DECIMAL(12, 2)) declare points: string;
  @Column(DataType.STRING(40)) declare unit: string | null;
  @Column(DataType.DECIMAL(12, 3)) declare minimumQuantity: string | null;
  @Column(DataType.INTEGER) declare minimumParticipants: number | null;
  @Column(DataType.INTEGER) declare maxOccurrences: number | null;
  @Column(DataType.INTEGER) declare maxOccurrencesPerMonth: number | null;
  @Column(DataType.INTEGER) declare maxOccurrencesPerParticipant: number | null;
  @Column(DataType.INTEGER) declare maxOccurrencesPerParticipantPerMonth: number | null;
  @Column(DataType.DECIMAL(5, 2)) declare minimumParticipationPercent: string | null;
  @AllowNull(false) @Default(false) @Column(DataType.BOOLEAN) declare repeatable: boolean;
  @AllowNull(false) @Default(true) @Column(DataType.BOOLEAN) declare evidenceRequired: boolean;
  @AllowNull(false) @Default({}) @Column(DataType.JSONB) declare rulesJson: JsonRecord;
  @AllowNull(false) @Default(ActivityStatus.ACTIVE) @Column(DataType.STRING(20))
  declare status: ActivityStatus;
  @HasMany(() => ActivityItemType) declare itemTypes?: ActivityItemType[];
}

@Table({
  tableName: 'activity_item_types',
  underscored: true,
  indexes: [{ unique: true, fields: ['activity_id', 'name'] }],
})
export class ActivityItemType extends UuidModel<ActivityItemType> {
  @ForeignKey(() => Activity) @AllowNull(false) @Column(DataType.UUID) declare activityId: string;
  @BelongsTo(() => Activity) declare activity?: Activity;
  @AllowNull(false) @Column(DataType.STRING(120)) declare name: string;
  @AllowNull(false) @Column(DataType.DECIMAL(12, 2)) declare pointsPerUnit: string;
  @AllowNull(false) @Column(DataType.STRING(40)) declare unit: string;
  @Column(DataType.DECIMAL(12, 3)) declare minimumQuantity: string | null;
}

@Table({
  tableName: 'submissions',
  underscored: true,
  indexes: [
    { fields: ['organization_id', 'status'] },
    { fields: ['organization_id', 'activity_id', 'action_date'] },
  ],
})
export class Submission extends UuidModel<Submission> {
  @ForeignKey(() => Organization) @AllowNull(false) @Column(DataType.UUID)
  declare organizationId: string;
  @BelongsTo(() => Organization) declare organization?: Organization;
  @ForeignKey(() => Campaign) @AllowNull(false) @Column(DataType.UUID) declare campaignId: string;
  @BelongsTo(() => Campaign) declare campaign?: Campaign;
  @ForeignKey(() => Activity) @AllowNull(false) @Column(DataType.UUID) declare activityId: string;
  @BelongsTo(() => Activity) declare activity?: Activity;
  @ForeignKey(() => User) @AllowNull(false) @Column(DataType.UUID) declare createdBy: string;
  @AllowNull(false) @Column(DataType.DATEONLY) declare actionDate: string;
  @Column(DataType.STRING(200)) declare institutionName: string | null;
  @Column(DataType.DECIMAL(12, 3)) declare quantity: string | null;
  @Column(DataType.STRING(40)) declare unit: string | null;
  @AllowNull(false) @Default({}) @Column(DataType.JSONB) declare detailsJson: JsonRecord;
  @AllowNull(false) @Default(SubmissionStatus.DRAFT) @Column(DataType.STRING(30))
  declare status: SubmissionStatus;
  @AllowNull(false) @Default(0) @Column(DataType.DECIMAL(12, 2))
  declare calculatedPoints: string;
  @AllowNull(false) @Default(0) @Column(DataType.DECIMAL(12, 2))
  declare approvedPoints: string;
  @Column(DataType.TEXT) declare notes: string | null;
  @HasMany(() => SubmissionItem) declare items?: SubmissionItem[];
  @HasMany(() => SubmissionParticipant) declare participants?: SubmissionParticipant[];
  @HasMany(() => Evidence) declare evidences?: Evidence[];
}

@Table({
  tableName: 'submission_items',
  underscored: true,
  indexes: [{ unique: true, fields: ['submission_id', 'activity_item_type_id'] }],
})
export class SubmissionItem extends UuidModel<SubmissionItem> {
  @ForeignKey(() => Submission) @AllowNull(false) @Column(DataType.UUID)
  declare submissionId: string;
  @BelongsTo(() => Submission) declare submission?: Submission;
  @ForeignKey(() => ActivityItemType) @AllowNull(false) @Column(DataType.UUID)
  declare activityItemTypeId: string;
  @BelongsTo(() => ActivityItemType) declare itemType?: ActivityItemType;
  @AllowNull(false) @Column(DataType.DECIMAL(12, 3)) declare quantity: string;
  @AllowNull(false) @Column(DataType.DECIMAL(12, 2)) declare calculatedPoints: string;
}

@Table({
  tableName: 'submission_participants',
  underscored: true,
  timestamps: false,
})
export class SubmissionParticipant extends Model<
  SubmissionParticipant,
  { submissionId: string; membershipId: string }
> {
  @PrimaryKey @ForeignKey(() => Submission) @Column(DataType.UUID) declare submissionId: string;
  @BelongsTo(() => Submission) declare submission?: Submission;
  @PrimaryKey @ForeignKey(() => Membership) @Column(DataType.UUID) declare membershipId: string;
  @BelongsTo(() => Membership) declare membership?: Membership;
}

@Table({
  tableName: 'evidences',
  underscored: true,
  indexes: [
    { unique: true, fields: ['organization_id', 'checksum'] },
    { fields: ['organization_id', 'submission_id'] },
  ],
})
export class Evidence extends UuidModel<Evidence> {
  @ForeignKey(() => Organization) @AllowNull(false) @Column(DataType.UUID)
  declare organizationId: string;
  @ForeignKey(() => Submission) @AllowNull(false) @Column(DataType.UUID)
  declare submissionId: string;
  @BelongsTo(() => Submission) declare submission?: Submission;
  @ForeignKey(() => User) @AllowNull(false) @Column(DataType.UUID) declare uploadedBy: string;
  @Unique @AllowNull(false) @Column(DataType.STRING(700)) declare storageKey: string;
  @AllowNull(false) @Column(DataType.STRING(255)) declare originalName: string;
  @AllowNull(false) @Column(DataType.STRING(100)) declare mimeType: string;
  @AllowNull(false) @Column(DataType.BIGINT) declare sizeBytes: string;
  @AllowNull(false) @Column(DataType.STRING(64)) declare checksum: string;
}

@Table({ tableName: 'validation_events', underscored: true, updatedAt: false })
export class ValidationEvent extends UuidCreatedModel<ValidationEvent> {
  @ForeignKey(() => Submission) @AllowNull(false) @Column(DataType.UUID)
  declare submissionId: string;
  @ForeignKey(() => User) @AllowNull(false) @Column(DataType.UUID) declare adminId: string;
  @AllowNull(false) @Column(DataType.STRING(30)) declare fromStatus: SubmissionStatus;
  @AllowNull(false) @Column(DataType.STRING(30)) declare toStatus: SubmissionStatus;
  @AllowNull(false) @Column(DataType.DECIMAL(12, 2)) declare pointsBefore: string;
  @AllowNull(false) @Column(DataType.DECIMAL(12, 2)) declare pointsAfter: string;
  @Column(DataType.TEXT) declare reason: string | null;
}

@Table({
  tableName: 'goals',
  underscored: true,
  indexes: [{ fields: ['organization_id', 'campaign_id', 'starts_at', 'ends_at'] }],
})
export class Goal extends UuidModel<Goal> {
  @ForeignKey(() => Organization) @Column(DataType.UUID)
  declare organizationId: string | null;
  @ForeignKey(() => Campaign) @AllowNull(false) @Column(DataType.UUID) declare campaignId: string;
  @BelongsTo(() => Campaign) declare campaign?: Campaign;
  @ForeignKey(() => Activity) @Column(DataType.UUID) declare activityId: string | null;
  @BelongsTo(() => Activity) declare activity?: Activity;
  @AllowNull(false) @Column(DataType.STRING(180)) declare title: string;
  @Column(DataType.TEXT) declare description: string | null;
  @AllowNull(false) @Column(DataType.STRING(20)) declare type: GoalType;
  @AllowNull(false) @Column(DataType.DATEONLY) declare startsAt: string;
  @AllowNull(false) @Column(DataType.DATEONLY) declare endsAt: string;
  @AllowNull(false) @Column(DataType.DECIMAL(12, 2)) declare targetPoints: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare targetActions: number;
  @AllowNull(false) @Default(0) @Column(DataType.INTEGER) declare targetParticipants: number;
  @AllowNull(false) @Default(0) @Column(DataType.DECIMAL(12, 3))
  declare targetQuantity: string;
  @Column(DataType.STRING(40)) declare unit: string | null;
}

@Table({
  tableName: 'audit_logs',
  underscored: true,
  updatedAt: false,
  indexes: [{ fields: ['organization_id', 'created_at'] }],
})
export class AuditLog extends UuidCreatedModel<AuditLog> {
  @Column(DataType.UUID) declare organizationId: string | null;
  @ForeignKey(() => User) @Column(DataType.UUID) declare actorUserId: string | null;
  @AllowNull(false) @Column(DataType.STRING(120)) declare action: string;
  @AllowNull(false) @Column(DataType.STRING(100)) declare entityType: string;
  @Column(DataType.UUID) declare entityId: string | null;
  @AllowNull(false) @Default({}) @Column(DataType.JSONB) declare metadataJson: JsonRecord;
}

export const MODELS = [
  Organization,
  User,
  Membership,
  RefreshToken,
  Campaign,
  Activity,
  ActivityItemType,
  Submission,
  SubmissionItem,
  SubmissionParticipant,
  Evidence,
  ValidationEvent,
  Goal,
  AuditLog,
];
