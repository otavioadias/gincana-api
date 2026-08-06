import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Goal, Organization, Submission } from '../../database/models';
import { AdminDashboardsController } from './admin-dashboards.controller';
import { EvidencesModule } from '../evidences/evidences.module';
import { GoalsModule } from '../goals/goals.module';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Submission, Goal, Organization]),
    GoalsModule,
    EvidencesModule,
  ],
  controllers: [
    DashboardsController,
    AdminDashboardsController,
    RankingsController,
  ],
  providers: [DashboardsService, RankingsService],
})
export class DashboardsModule {}
