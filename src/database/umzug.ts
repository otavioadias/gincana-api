import { Sequelize } from 'sequelize-typescript';
import { Umzug, SequelizeStorage } from 'umzug';
import { MODELS } from './models';

interface MigrationModule {
  up(input: { context: Sequelize }): Promise<void>;
  down(input: { context: Sequelize }): Promise<void>;
}

function assertMigrationModule(value: unknown, name: string): asserts value is MigrationModule {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('up' in value) ||
    typeof value.up !== 'function' ||
    !('down' in value) ||
    typeof value.down !== 'function'
  ) {
    throw new Error(`Migration ${name} must export up and down functions`);
  }
}

export function createSequelize(): Sequelize {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    models: MODELS,
    logging: false,
  });
}

export function createMigrator(sequelize: Sequelize): Umzug<Sequelize> {
  const migrationExtension = __filename.endsWith('.ts') ? 'ts' : 'js';
  return new Umzug({
    migrations: {
      glob: [`migrations/*.${migrationExtension}`, { cwd: __dirname }],
      resolve: ({ name, path, context }) => {
        if (!path) throw new Error(`Migration path is missing for ${name}`);
        const stableName = name.replace(/\.(?:ts|js)$/, '');
        return {
          name: stableName,
          up: async () => {
            const migration: unknown = await import(path);
            assertMigrationModule(migration, stableName);
            await migration.up({ context });
          },
          down: async () => {
            const migration: unknown = await import(path);
            assertMigrationModule(migration, stableName);
            await migration.down({ context });
          },
        };
      },
    },
    context: sequelize,
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });
}

export async function normalizeMigrationNames(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    DO $$
    BEGIN
      IF to_regclass('"SequelizeMeta"') IS NOT NULL THEN
        UPDATE "SequelizeMeta"
        SET name = regexp_replace(name, '\\.(ts|js)$', '');
      END IF;
    END
    $$;
  `);
}
