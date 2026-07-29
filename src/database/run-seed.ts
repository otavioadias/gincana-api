import 'reflect-metadata';
import { config } from 'dotenv';
import { createSequelize } from './umzug';
import { seedDemo } from './seeders/demo.seeder';

config();

async function main(): Promise<void> {
  const sequelize = createSequelize();
  try {
    await sequelize.authenticate();
    await seedDemo(sequelize);
  } finally {
    await sequelize.close();
  }
}

void main();
