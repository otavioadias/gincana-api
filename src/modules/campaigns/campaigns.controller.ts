import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipRole, PlatformRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateCampaignDto, UpdateCampaignDto } from './campaigns.dto';
import { CampaignsService } from './campaigns.service';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  PlatformRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}
  @Get() findAll() {
    return this.campaigns.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }
  @Roles(PlatformRole.ADMIN)
  @Post() create(@Body() input: CreateCampaignDto) {
    return this.campaigns.create(input);
  }
  @Roles(PlatformRole.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateCampaignDto) {
    return this.campaigns.update(id, input);
  }
  @Roles(PlatformRole.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }
}
