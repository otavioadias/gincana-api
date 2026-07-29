import { QueryTypes, Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      UPDATE users
      SET platform_role = CASE
        WHEN platform_role IN ('SUPER_ADMIN', 'VALIDATOR') THEN 'ADMIN'
        ELSE 'USER'
      END,
      updated_at = now();

      ALTER TABLE campaigns ALTER COLUMN organization_id DROP NOT NULL;
      ALTER TABLE activities ALTER COLUMN organization_id DROP NOT NULL;
      ALTER TABLE goals ALTER COLUMN organization_id DROP NOT NULL;
      ALTER TABLE validation_events RENAME COLUMN validator_id TO admin_id;

      UPDATE campaigns SET organization_id = NULL, updated_at = now();
      UPDATE activities SET organization_id = NULL, updated_at = now();
      UPDATE goals SET organization_id = NULL, updated_at = now();

      CREATE INDEX campaigns_shared_status
        ON campaigns (status, starts_at, ends_at)
        WHERE organization_id IS NULL;
      CREATE INDEX activities_shared_campaign_status
        ON activities (campaign_id, status)
        WHERE organization_id IS NULL;
      CREATE INDEX goals_shared_campaign_period
        ON goals (campaign_id, starts_at, ends_at)
        WHERE organization_id IS NULL;
    `,
    { type: QueryTypes.RAW },
  );
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      DROP INDEX IF EXISTS goals_shared_campaign_period;
      DROP INDEX IF EXISTS activities_shared_campaign_status;
      DROP INDEX IF EXISTS campaigns_shared_status;
      ALTER TABLE validation_events RENAME COLUMN admin_id TO validator_id;

      UPDATE users
      SET platform_role = CASE
        WHEN platform_role = 'ADMIN' THEN 'SUPER_ADMIN'
        ELSE 'USER'
      END,
      updated_at = now();
    `,
    { type: QueryTypes.RAW },
  );
  // Shared campaigns cannot be reassigned to one team safely, so the nullable
  // columns intentionally remain nullable on rollback.
}
