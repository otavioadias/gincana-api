import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipRole, PlatformRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateGoalDto,
  CreateMonthlyPlanDto,
  GoalProgressDto,
  UpdateGoalDto,
} from './goals.dto';
import { GoalsService } from './goals.service';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  PlatformRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}
  @Get() findAll(
    @Query('campaignId') campaignId?: string,
  ) {
    return this.goals.findAll(campaignId);
  }
  @Roles(PlatformRole.ADMIN)
  @Post('monthly-plan')
  createMonthlyPlan(
    @Body() input: CreateMonthlyPlanDto,
  ) {
    return this.goals.createMonthlyPlan(input);
  }
  @ApiOkResponse({ type: GoalProgressDto })
  @Get(':id/progress')
  progress(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('organizationId') organizationId?: string,
  ) {
    const teamId = user.organizationId ?? organizationId;
    if (!teamId) {
      throw new BadRequestException('organizationId is required for an admin');
    }
    return this.goals.progress(teamId, id);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.goals.findOne(id);
  }
  @Roles(PlatformRole.ADMIN)
  @Post() create(@Body() input: CreateGoalDto) {
    return this.goals.create(input);
  }
  @Roles(PlatformRole.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateGoalDto) {
    return this.goals.update(id, input);
  }
  @Roles(PlatformRole.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.goals.remove(id);
  }
}
