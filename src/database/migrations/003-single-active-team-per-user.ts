import { QueryTypes, Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_team_per_user
      ON memberships (user_id)
      WHERE status = 'ACTIVE';
    `,
    { type: QueryTypes.RAW },
  );
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    'DROP INDEX IF EXISTS memberships_one_active_team_per_user',
    { type: QueryTypes.RAW },
  );
}
