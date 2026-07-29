import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import {
  CreateGoalDto,
  CreateMonthlyPlanDto,
  GoalProgressDto,
  UpdateGoalDto,
} from './goals.dto';
import { GoalsService } from './goals.service';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}
  @Get() findAll(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.goals.findAll(user.organizationId!, campaignId);
  }
  @Roles(MembershipRole.MANAGER)
  @Post('monthly-plan')
  createMonthlyPlan(
    @Body() input: CreateMonthlyPlanDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.goals.createMonthlyPlan(user.organizationId!, input);
  }
  @ApiOkResponse({ type: GoalProgressDto })
  @Get(':id/progress')
  progress(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.goals.progress(user.organizationId!, id);
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.goals.findOne(user.organizationId!, id);
  }
  @Roles(MembershipRole.MANAGER)
  @Post() create(@Body() input: CreateGoalDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.goals.create(user.organizationId!, input);
  }
  @Roles(MembershipRole.MANAGER)
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateGoalDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.goals.update(user.organizationId!, id, input);
  }
  @Roles(MembershipRole.MANAGER)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.goals.remove(user.organizationId!, id);
  }
}
