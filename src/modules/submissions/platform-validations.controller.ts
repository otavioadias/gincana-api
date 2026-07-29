import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformRole, SubmissionStatus } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EvidencesService } from '../evidences/evidences.service';
import { ValidateSubmissionDto } from './submissions.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('platform-validations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.VALIDATOR)
@Controller('validation/submissions')
export class PlatformValidationsController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly evidences: EvidencesService,
  ) {}

  @Get()
  findAll(@Query('status') status?: SubmissionStatus) {
    return this.submissions.findAllForValidation(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.submissions.findOneForValidation(id);
  }

  @Post(':id/validate')
  validate(
    @Param('id') id: string,
    @Body() input: ValidateSubmissionDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.submissions.validate(id, user.userId, input);
  }

  @Get(':id/evidences/:evidenceId/url')
  evidenceUrl(
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.evidences.signedUrlForValidation(id, evidenceId);
  }
}
