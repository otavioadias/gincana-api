import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardsService } from './dashboards.service';
import { AdminTeamSummaryDto } from './dashboards.dto';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.ADMIN)
@Controller('admin/dashboard/teams')
export class AdminDashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get()
  @ApiOkResponse({ type: [AdminTeamSummaryDto] })
  findAll(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.dashboards.adminTeams(user.userId, campaignId);
  }

  @Get(':organizationId')
  @ApiOkResponse({ type: AdminTeamSummaryDto })
  findOne(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.dashboards.adminTeam(
      organizationId,
      user.userId,
      campaignId,
    );
  }
}
