import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Activity,
  ActivityItemType,
  Campaign,
  Evidence,
  Membership,
  Organization,
  Submission,
  SubmissionItem,
  SubmissionParticipant,
  ValidationEvent,
} from '../../database/models';
import { ActivitiesModule } from '../activities/activities.module';
import { AuditModule } from '../audit/audit.module';
import { EvidencesModule } from '../evidences/evidences.module';
import { AdminSubmissionsController } from './admin-submissions.controller';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Submission,
      SubmissionItem,
      SubmissionParticipant,
      Activity,
      ActivityItemType,
      Campaign,
      Membership,
      Organization,
      Evidence,
      ValidationEvent,
    ]),
    ActivitiesModule,
    AuditModule,
    EvidencesModule,
  ],
  controllers: [SubmissionsController, AdminSubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
