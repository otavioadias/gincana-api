export enum PlatformRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum MembershipRole {
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum ActivityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ScoringType {
  FIXED = 'FIXED',
  PER_ITEM = 'PER_ITEM',
  PER_KG = 'PER_KG',
  PER_MEMBER = 'PER_MEMBER',
  PER_COMPLETE_KIT = 'PER_COMPLETE_KIT',
  TIERED = 'TIERED',
  MANUAL = 'MANUAL',
}

export enum SubmissionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  NEEDS_CHANGES = 'NEEDS_CHANGES',
  APPROVED = 'APPROVED',
  PARTIALLY_APPROVED = 'PARTIALLY_APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum GoalType {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CAMPAIGN = 'CAMPAIGN',
  CUSTOM = 'CUSTOM',
}

export enum GoalStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ACHIEVED = 'ACHIEVED',
  EXPIRED = 'EXPIRED',
}

export enum AvailabilityBlockScope {
  CAMPAIGN = 'CAMPAIGN',
  MONTH = 'MONTH',
  DATE = 'DATE',
}
