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
  ActivityAvailabilityDto,
  ActivityAvailabilityQueryDto,
  CreateActivityDto,
  UpdateActivityDto,
} from './activities.dto';
import { ActivitiesService } from './activities.service';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}
  @Get() findAll(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('campaignId') campaignId?: string,
    @Query('actionDate') actionDate?: string,
  ) {
    return this.activities.findAll(user.organizationId!, campaignId, actionDate);
  }
  @ApiOkResponse({ type: ActivityAvailabilityDto })
  @Get(':id/availability')
  availability(
    @Param('id') id: string,
    @Query() query: ActivityAvailabilityQueryDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.activities.availabilityById(user.organizationId!, id, query.actionDate);
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.activities.findOne(user.organizationId!, id);
  }
  @Roles(MembershipRole.MANAGER)
  @Post() create(@Body() input: CreateActivityDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.activities.create(user.organizationId!, input);
  }
  @Roles(MembershipRole.MANAGER)
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateActivityDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.activities.update(user.organizationId!, id, input);
  }
  @Roles(MembershipRole.MANAGER)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.activities.remove(user.organizationId!, id);
  }
}
