import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { DashboardsService } from './dashboards.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('dashboard')
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedPrincipal, @Query('campaignId') campaignId?: string) {
    return this.dashboards.summary(user.organizationId!, user.userId, campaignId);
  }
  @Get('by-activity')
  byActivity(@CurrentUser() user: AuthenticatedPrincipal, @Query('campaignId') campaignId?: string) {
    return this.dashboards.byActivity(user.organizationId!, campaignId);
  }
}
