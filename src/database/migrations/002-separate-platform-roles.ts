import { QueryTypes, Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      UPDATE users AS u
      SET platform_role = 'VALIDATOR',
          updated_at = now()
      FROM memberships AS m
      WHERE m.user_id = u.id
        AND m.role = 'VALIDATOR';

      DELETE FROM memberships
      WHERE role = 'VALIDATOR';

      UPDATE users AS u
      SET platform_role = 'LEADER',
          updated_at = now()
      WHERE u.platform_role = 'USER'
        AND EXISTS (
          SELECT 1
          FROM memberships AS m
          WHERE m.user_id = u.id
            AND m.role = 'MANAGER'
        );
    `,
    { type: QueryTypes.RAW },
  );
}

export async function down({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      UPDATE users
      SET platform_role = 'USER',
          updated_at = now()
      WHERE platform_role IN ('VALIDATOR', 'LEADER');
    `,
    { type: QueryTypes.RAW },
  );
}
