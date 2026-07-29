import { QueryTypes, Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
  await context.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"', { type: QueryTypes.RAW });
  await context.query(`
    CREATE TABLE organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(160) NOT NULL,
      slug varchar(100) NOT NULL UNIQUE,
      logo_key varchar(500),
      primary_color varchar(7) NOT NULL DEFAULT '#164E63',
      secondary_color varchar(7) NOT NULL DEFAULT '#F59E0B',
      status varchar(20) NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(160) NOT NULL,
      email varchar(320) NOT NULL UNIQUE,
      password_hash varchar(255) NOT NULL,
      platform_role varchar(30) NOT NULL DEFAULT 'USER',
      must_change_password boolean NOT NULL DEFAULT true,
      status varchar(20) NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role varchar(30) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'ACTIVE',
      joined_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, user_id)
    );
    CREATE TABLE refresh_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash varchar(64) NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      device_info varchar(500),
      replaced_by_token_id uuid REFERENCES refresh_tokens(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE campaigns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name varchar(180) NOT NULL,
      description text,
      starts_at date NOT NULL,
      ends_at date NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'DRAFT',
      minimum_actions_per_month integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (ends_at >= starts_at)
    );
    CREATE INDEX campaigns_tenant_status ON campaigns (organization_id, status);
    CREATE TABLE activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name varchar(180) NOT NULL,
      description text,
      scoring_type varchar(30) NOT NULL,
      points numeric(12,2) NOT NULL DEFAULT 0,
      unit varchar(40),
      minimum_quantity numeric(12,3),
      max_occurrences integer,
      minimum_participation_percent numeric(5,2),
      repeatable boolean NOT NULL DEFAULT false,
      evidence_required boolean NOT NULL DEFAULT true,
      rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      status varchar(20) NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (minimum_participation_percent IS NULL OR
        minimum_participation_percent BETWEEN 0 AND 100)
    );
    CREATE INDEX activities_tenant_campaign_status
      ON activities (organization_id, campaign_id, status);
    CREATE TABLE activity_item_types (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      name varchar(120) NOT NULL,
      points_per_unit numeric(12,2) NOT NULL,
      unit varchar(40) NOT NULL,
      minimum_quantity numeric(12,3),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (activity_id, name)
    );
    CREATE TABLE submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id uuid NOT NULL REFERENCES campaigns(id),
      activity_id uuid NOT NULL REFERENCES activities(id),
      created_by uuid NOT NULL REFERENCES users(id),
      action_date date NOT NULL,
      institution_name varchar(200),
      quantity numeric(12,3),
      unit varchar(40),
      status varchar(30) NOT NULL DEFAULT 'DRAFT',
      calculated_points numeric(12,2) NOT NULL DEFAULT 0,
      approved_points numeric(12,2) NOT NULL DEFAULT 0,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX submissions_tenant_status ON submissions (organization_id, status);
    CREATE INDEX submissions_tenant_activity_date
      ON submissions (organization_id, activity_id, action_date);
    CREATE TABLE submission_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      activity_item_type_id uuid NOT NULL REFERENCES activity_item_types(id),
      quantity numeric(12,3) NOT NULL,
      calculated_points numeric(12,2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (submission_id, activity_item_type_id)
    );
    CREATE TABLE submission_participants (
      submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      membership_id uuid NOT NULL REFERENCES memberships(id),
      PRIMARY KEY (submission_id, membership_id)
    );
    CREATE TABLE evidences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      uploaded_by uuid NOT NULL REFERENCES users(id),
      storage_key varchar(700) NOT NULL UNIQUE,
      original_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      size_bytes bigint NOT NULL,
      checksum varchar(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX evidences_tenant_checksum
      ON evidences (organization_id, checksum);
    CREATE INDEX evidences_tenant_submission ON evidences (organization_id, submission_id);
    CREATE TABLE validation_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      validator_id uuid NOT NULL REFERENCES users(id),
      from_status varchar(30) NOT NULL,
      to_status varchar(30) NOT NULL,
      points_before numeric(12,2) NOT NULL,
      points_after numeric(12,2) NOT NULL,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE goals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      type varchar(20) NOT NULL,
      starts_at date NOT NULL,
      ends_at date NOT NULL,
      target_points numeric(12,2) NOT NULL,
      target_actions integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (ends_at >= starts_at)
    );
    CREATE INDEX goals_tenant_campaign_period
      ON goals (organization_id, campaign_id, starts_at, ends_at);
    CREATE TABLE audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
      actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action varchar(120) NOT NULL,
      entity_type varchar(100) NOT NULL,
      entity_id uuid,
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_logs_tenant_created ON audit_logs (organization_id, created_at);
  `);
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
  await context.query(`
    DROP TABLE IF EXISTS audit_logs, goals, validation_events, evidences,
      submission_participants, submission_items, submissions, activity_item_types,
      activities, campaigns, refresh_tokens, memberships, users, organizations CASCADE;
  `);
}
