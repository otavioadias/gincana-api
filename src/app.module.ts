import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { EvidencesModule } from './modules/evidences/evidences.module';
import { GoalsModule } from './modules/goals/goals.module';
import { MembersModule } from './modules/members/members.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { TeamSettingsModule } from './modules/team-settings/team-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    MembersModule,
    CampaignsModule,
    ActivitiesModule,
    SubmissionsModule,
    EvidencesModule,
    GoalsModule,
    DashboardsModule,
    TeamSettingsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
