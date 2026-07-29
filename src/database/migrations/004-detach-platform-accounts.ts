import { QueryTypes, Sequelize } from 'sequelize';

export async function up({ context }: { context: Sequelize }): Promise<void> {
  await context.query(
    `
      DELETE FROM memberships AS m
      USING users AS u
      WHERE m.user_id = u.id
        AND u.platform_role IN ('SUPER_ADMIN', 'VALIDATOR');
    `,
    { type: QueryTypes.RAW },
  );
}

export async function down(): Promise<void> {
  // Os vínculos legados removidos não podem ser reconstruídos com segurança.
}
