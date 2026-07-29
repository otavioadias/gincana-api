import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELS } from './models';

@Global()
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        uri: config.getOrThrow<string>('DATABASE_URL'),
        models: MODELS,
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development' ? console.log : false,
        define: { underscored: true },
      }),
    }),
    SequelizeModule.forFeature(MODELS),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
