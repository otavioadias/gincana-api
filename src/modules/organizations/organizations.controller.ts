import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Organization } from '../../database/models';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('admin-organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.ADMIN)
@Controller('admin/organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get() findAll(): Promise<Organization[]> { return this.organizations.findAll(); }
  @Get(':id') findOne(@Param('id') id: string): Promise<Organization> {
    return this.organizations.findOne(id);
  }
  @Post() create(@Body() input: CreateOrganizationDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.organizations.create(input, user.userId);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() input: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.organizations.update(id, input, user.userId);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.organizations.remove(id, user.userId);
  }
}
