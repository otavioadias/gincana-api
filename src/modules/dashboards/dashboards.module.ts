import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Goal, Organization, Submission } from '../../database/models';
import { AdminDashboardsController } from './admin-dashboards.controller';
import { GoalsModule } from '../goals/goals.module';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Submission, Goal, Organization]),
    GoalsModule,
  ],
  controllers: [DashboardsController, AdminDashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
