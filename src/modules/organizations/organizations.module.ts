import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Membership, Organization, User } from '../../database/models';
import { AuditModule } from '../audit/audit.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [SequelizeModule.forFeature([Organization, User, Membership]), AuditModule],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
