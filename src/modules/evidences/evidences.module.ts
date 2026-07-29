import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Evidence, Submission } from '../../database/models';
import { EvidencesController } from './evidences.controller';
import { EvidencesService } from './evidences.service';
import { StorageService } from './storage.service';

@Module({
  imports: [SequelizeModule.forFeature([Evidence, Submission])],
  controllers: [EvidencesController],
  providers: [EvidencesService, StorageService],
  exports: [EvidencesService, StorageService],
})
export class EvidencesModule {}
