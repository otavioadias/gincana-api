import 'reflect-metadata';
import { config } from 'dotenv';
import { seedAll } from './seeders';
import {
  createMigrator,
  createSequelize,
  normalizeMigrationNames,
} from './umzug';

config();

async function main(): Promise<void> {
  const sequelize = createSequelize();
  try {
    await sequelize.authenticate();
    await normalizeMigrationNames(sequelize);
    await createMigrator(sequelize).up();
    await seedAll(sequelize);
  } finally {
    await sequelize.close();
  }
}

void main();
