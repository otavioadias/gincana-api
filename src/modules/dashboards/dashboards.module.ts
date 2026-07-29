import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Goal, Submission } from '../../database/models';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  imports: [SequelizeModule.forFeature([Submission, Goal])],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
