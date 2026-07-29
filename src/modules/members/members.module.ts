import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Membership, User } from '../../database/models';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [SequelizeModule.forFeature([Membership, User])],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
