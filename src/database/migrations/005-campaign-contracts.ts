import { QueryTypes, Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      ALTER TABLE submissions
        ADD COLUMN details_json jsonb NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE activities
        ADD COLUMN minimum_participants integer,
        ADD COLUMN max_occurrences_per_month integer,
        ADD COLUMN max_occurrences_per_participant integer,
        ADD COLUMN max_occurrences_per_participant_per_month integer,
        ADD CONSTRAINT activities_minimum_participants_positive
          CHECK (minimum_participants IS NULL OR minimum_participants > 0) NOT VALID,
        ADD CONSTRAINT activities_max_occurrences_positive
          CHECK (max_occurrences IS NULL OR max_occurrences > 0) NOT VALID,
        ADD CONSTRAINT activities_max_occurrences_per_month_positive
          CHECK (max_occurrences_per_month IS NULL OR max_occurrences_per_month > 0)
          NOT VALID,
        ADD CONSTRAINT activities_max_occurrences_per_participant_positive
          CHECK (
            max_occurrences_per_participant IS NULL
            OR max_occurrences_per_participant > 0
          ) NOT VALID,
        ADD CONSTRAINT activities_max_occurrences_per_participant_month_positive
          CHECK (
            max_occurrences_per_participant_per_month IS NULL
            OR max_occurrences_per_participant_per_month > 0
          ) NOT VALID;

      ALTER TABLE goals
        ADD COLUMN title varchar(180),
        ADD COLUMN description text,
        ADD COLUMN activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
        ADD COLUMN target_participants integer NOT NULL DEFAULT 0,
        ADD COLUMN target_quantity numeric(12,3) NOT NULL DEFAULT 0,
        ADD COLUMN unit varchar(40);

      UPDATE goals
      SET title = CASE type
        WHEN 'MONTHLY' THEN 'Meta mensal'
        WHEN 'WEEKLY' THEN 'Meta semanal'
        ELSE 'Meta'
      END
      WHERE title IS NULL;

      ALTER TABLE goals
        ALTER COLUMN title SET NOT NULL,
        ADD CONSTRAINT goals_targets_nonnegative
          CHECK (
            target_points >= 0
            AND target_actions >= 0
            AND target_participants >= 0
            AND target_quantity >= 0
          ) NOT VALID,
        ADD CONSTRAINT goals_at_least_one_target
          CHECK (
            target_points > 0
            OR target_actions > 0
            OR target_participants > 0
            OR target_quantity > 0
          ) NOT VALID;

      CREATE INDEX submission_participants_membership
        ON submission_participants (membership_id, submission_id);
    `,
    { type: QueryTypes.RAW },
  );
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      DROP INDEX IF EXISTS submission_participants_membership;

      ALTER TABLE goals
        DROP CONSTRAINT IF EXISTS goals_at_least_one_target,
        DROP CONSTRAINT IF EXISTS goals_targets_nonnegative,
        DROP COLUMN IF EXISTS unit,
        DROP COLUMN IF EXISTS target_quantity,
        DROP COLUMN IF EXISTS target_participants,
        DROP COLUMN IF EXISTS activity_id,
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS title;

      ALTER TABLE activities
        DROP CONSTRAINT IF EXISTS activities_max_occurrences_per_participant_month_positive,
        DROP CONSTRAINT IF EXISTS activities_max_occurrences_per_participant_positive,
        DROP CONSTRAINT IF EXISTS activities_max_occurrences_per_month_positive,
        DROP CONSTRAINT IF EXISTS activities_max_occurrences_positive,
        DROP CONSTRAINT IF EXISTS activities_minimum_participants_positive,
        DROP COLUMN IF EXISTS max_occurrences_per_participant_per_month,
        DROP COLUMN IF EXISTS max_occurrences_per_participant,
        DROP COLUMN IF EXISTS max_occurrences_per_month,
        DROP COLUMN IF EXISTS minimum_participants;

      ALTER TABLE submissions DROP COLUMN IF EXISTS details_json;
    `,
    { type: QueryTypes.RAW },
  );
}
