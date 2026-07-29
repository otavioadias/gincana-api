import 'reflect-metadata';
import { config } from 'dotenv';
import { createMigrator, createSequelize, normalizeMigrationNames } from './umzug';

config();

async function main(): Promise<void> {
  const sequelize = createSequelize();
  try {
    await normalizeMigrationNames(sequelize);
    const migrator = createMigrator(sequelize);
    if (process.argv[2] === 'down') await migrator.down();
    else await migrator.up();
  } finally {
    await sequelize.close();
  }
}

void main();
