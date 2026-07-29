import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipRole, PlatformRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ActivityAvailabilityDto,
  ActivityAvailabilityQueryDto,
  CreateActivityDto,
  UpdateActivityDto,
} from './activities.dto';
import { ActivitiesService } from './activities.service';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  PlatformRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}
  @Get() findAll(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('campaignId') campaignId?: string,
    @Query('actionDate') actionDate?: string,
  ) {
    return this.activities.findAll(user.organizationId, campaignId, actionDate);
  }
  @ApiOkResponse({ type: ActivityAvailabilityDto })
  @Get(':id/availability')
  availability(
    @Param('id') id: string,
    @Query() query: ActivityAvailabilityQueryDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    const teamId = user.organizationId ?? query.organizationId;
    if (!teamId) {
      throw new BadRequestException('organizationId is required for an admin');
    }
    return this.activities.availabilityById(teamId, id, query.actionDate);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.activities.findOne(id);
  }
  @Roles(PlatformRole.ADMIN)
  @Post() create(@Body() input: CreateActivityDto) {
    return this.activities.create(input);
  }
  @Roles(PlatformRole.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateActivityDto) {
    return this.activities.update(id, input);
  }
  @Roles(PlatformRole.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.activities.remove(id);
  }
}
