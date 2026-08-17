import { Sequelize } from 'sequelize-typescript';
import { seedAdminUsers } from './admin-users.seeder';
import { seedDemo } from './demo.seeder';

export async function seedAll(sequelize: Sequelize): Promise<void> {
  await seedAdminUsers(sequelize);
  await seedDemo(sequelize);
}
