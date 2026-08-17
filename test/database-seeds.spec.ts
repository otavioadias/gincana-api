import * as bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize-typescript';
import { EntityStatus, PlatformRole } from '../src/common/enums';
import { User } from '../src/database/models';
import { seedAdminUsers } from '../src/database/seeders/admin-users.seeder';

describe('Admin user seeds', () => {
  const previousRounds = process.env.BCRYPT_ROUNDS;

  afterEach(() => {
    jest.restoreAllMocks();
    if (previousRounds === undefined) delete process.env.BCRYPT_ROUNDS;
    else process.env.BCRYPT_ROUNDS = previousRounds;
  });

  it('upserts the general admin and Figueiredo with full platform access', async () => {
    process.env.BCRYPT_ROUNDS = '4';
    const transaction = {};
    const update = jest.fn().mockResolvedValue(undefined);
    const findOrCreate = jest
      .spyOn(User, 'findOrCreate')
      .mockResolvedValue([{ update }, true] as never);
    const sequelize = {
      transaction: jest.fn(
        (callback: (value: object) => Promise<void>) => callback(transaction),
      ),
    } as unknown as Sequelize;

    await seedAdminUsers(sequelize);

    expect(findOrCreate).toHaveBeenCalledTimes(2);
    const generalAdminSeed = findOrCreate.mock.calls[0][0] as unknown as {
      where: { email: string };
      defaults: { platformRole: PlatformRole; status: EntityStatus };
      transaction: object;
    };
    const figueiredoSeed = findOrCreate.mock.calls[1][0] as unknown as {
      where: { email: string };
      defaults: {
        passwordHash: string;
        platformRole: PlatformRole;
        mustChangePassword: boolean;
        status: EntityStatus;
      };
      transaction: object;
    };
    expect(generalAdminSeed).toMatchObject({
      where: { email: 'admin@gincana.local' },
      defaults: {
        platformRole: PlatformRole.ADMIN,
        status: EntityStatus.ACTIVE,
      },
      transaction,
    });
    expect(figueiredoSeed).toMatchObject({
      where: { email: 'afigueiredo@gpcargo.com.br' },
      defaults: {
        platformRole: PlatformRole.ADMIN,
        mustChangePassword: false,
        status: EntityStatus.ACTIVE,
      },
      transaction,
    });
    await expect(
      bcrypt.compare('figueiredo123', figueiredoSeed.defaults.passwordHash),
    ).resolves.toBe(true);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
