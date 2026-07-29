import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubmissionStatus } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateSubmissionDto, UpdateSubmissionDto } from './submissions.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}
  @Get() findAll(@CurrentUser() user: AuthenticatedPrincipal, @Query('status') status?: SubmissionStatus) {
    return this.submissions.findAll(user.organizationId!, status);
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.submissions.findOne(user.organizationId!, id);
  }
  @Post() create(@Body() input: CreateSubmissionDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.submissions.create(user.organizationId!, user.userId, input);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateSubmissionDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.submissions.update(user.organizationId!, id, user.userId, input);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.submissions.remove(user.organizationId!, id, user.userId);
  }
  @Post(':id/submit') submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.submissions.submit(user.organizationId!, id, user.userId);
  }
}
