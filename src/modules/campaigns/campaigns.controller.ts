import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateCampaignDto, UpdateCampaignDto } from './campaigns.dto';
import { CampaignsService } from './campaigns.service';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}
  @Get() findAll(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.campaigns.findAll(user.organizationId!);
  }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.campaigns.findOne(user.organizationId!, id);
  }
  @Roles(MembershipRole.MANAGER)
  @Post() create(@Body() input: CreateCampaignDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.campaigns.create(user.organizationId!, input);
  }
  @Roles(MembershipRole.MANAGER)
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateCampaignDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.campaigns.update(user.organizationId!, id, input);
  }
  @Roles(MembershipRole.MANAGER)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.campaigns.remove(user.organizationId!, id);
  }
}
