import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Organization } from '../../database/models';
import { AuditModule } from '../audit/audit.module';
import { EvidencesModule } from '../evidences/evidences.module';
import { TeamSettingsController } from './team-settings.controller';
import { TeamSettingsService } from './team-settings.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Organization]),
    AuditModule,
    EvidencesModule,
  ],
  controllers: [TeamSettingsController],
  providers: [TeamSettingsService],
})
export class TeamSettingsModule {}
