import * as bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize-typescript';
import { EntityStatus, PlatformRole } from '../../common/enums';
import { User } from '../models';

type AdminUserSeed = {
  name: string;
  email: string;
  password: string;
};

function adminUsers(): AdminUserSeed[] {
  return [
    {
      name: 'Administrador Geral',
      email: 'admin@gincana.local',
      password:
        process.env.ADMIN_PASSWORD ??
        process.env.DEMO_PASSWORD ??
        'ChangeMe123!',
    },
    {
      name: 'A. Figueiredo',
      email: 'afigueiredo@gpcargo.com.br',
      password: process.env.FIGUEIREDO_PASSWORD ?? 'figueiredo123',
    },
    {
      name: 'Eduardo Augusto',
      email: 'eaugusto@gpcargo.com.br',
      password: process.env.EAUGUSTO_PASSWORD ?? 'eduardo123',
    },
    {
      name: 'I. Armond',
      email: 'iarmond@gpcargo.com.br',
      password: process.env.IARMOND_PASSWORD ?? 'armond123',
    },
  ];
}

export async function seedAdminUsers(sequelize: Sequelize): Promise<void> {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  await sequelize.transaction(async (transaction) => {
    for (const seed of adminUsers()) {
      const passwordHash = await bcrypt.hash(seed.password, rounds);
      const values = {
        name: seed.name,
        email: seed.email,
        passwordHash,
        platformRole: PlatformRole.ADMIN,
        mustChangePassword: false,
        status: EntityStatus.ACTIVE,
      };
      const [user] = await User.findOrCreate({
        where: { email: seed.email },
        defaults: values,
        transaction,
      });

      await user.update(values, { transaction });
    }
  });
}
