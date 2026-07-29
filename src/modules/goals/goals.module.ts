import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Activity, Campaign, Goal } from '../../database/models';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [SequelizeModule.forFeature([Goal, Campaign, Activity])],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
